'use strict';

/* ============================================================
   同步任务：抓取 → 过滤 → 去重 → 详情 → 入库 → 日志
   ============================================================ */

const { SOURCES } = require('./sources');
const { httpGet, sleep, parseAnchors, parseDetail, draftSummary } = require('./extract');
const { classify, isCultural, isExcluded } = require('./classify');
const store = require('./store');

const REGION_NAMES = {
  national: '国家级',
  zhejiang: '浙江省',
  beijing: '北京市',
  shanghai: '上海市',
  hangzhou: '杭州市'
};

const POLITE_DELAY_MS = 600;

function nowISO() {
  return new Date().toISOString();
}

function makePolicyId(url) {
  return 'p-' + store.hashText(url);
}

function buildPolicy(source, candidate, detail) {
  const title = (detail && detail.title) || candidate.title;
  const body = (detail && detail.body) || '';
  const publishedAt = (detail && detail.publishedAt) || candidate.publishedAt || null;
  const summary = draftSummary(body);
  const cls = classify({ title, body, regionCode: source.regionCode });

  return {
    id: makePolicyId(candidate.url),
    title,
    normalizedTitle: store.normalizeTitle(title),
    documentNumber: (detail && detail.docNumber) || null,
    regionCode: source.regionCode,
    regionLevel: source.regionCode,
    regionName: REGION_NAMES[source.regionCode] || source.regionCode,
    issuingAgency: (detail && detail.agency) || source.organization || null,
    publishedAt,
    effectiveAt: null,
    expiresAt: null,
    documentType: cls.documentType,
    policyStatus: 'unknown',
    applicationStatus: 'not_applicable',
    summaryWhat: summary || null,
    summaryWho: null,
    summaryIndustry: null,
    summarySource: 'extractive_draft',
    summaryReviewStatus: summary ? 'pending' : 'draft',
    topicTags: cls.topicTags,
    toolTags: cls.toolTags,
    targetGroups: [],
    officialUrl: candidate.url,
    linkStatus: 'ok',
    sourceId: source.id,
    sourceName: source.name,
    sourcePublishedUrl: source.listUrl,
    applicationStartAt: null,
    applicationDeadline: null,
    deadlineVerified: false,
    isMajorPolicy: false,
    majorPolicyReason: null,
    homepagePinUntil: null,
    isKeyPolicy: cls.isKeyPolicy,
    keyPolicyRule: cls.keyPolicyRule,
    verificationStatus: 'pending',
    visibilityStatus: 'published',
    sourceLastCheckedAt: nowISO(),
    collectedAt: nowISO(),
    lastUpdatedAt: nowISO(),
    contentHash: store.hashText(title + '|' + body.slice(0, 1500)),
    isMock: false,
    keyClauses: [],
    relations: [],
    bodyExcerpt: body.slice(0, 600)
  };
}

function selectCandidates(source, html, listUrl) {
  const anchors = parseAnchors(html, listUrl || source.listUrl || (source.listUrls && source.listUrls[0]));
  const seen = new Set();
  const picked = [];

  for (const a of anchors) {
    if (!source.articleRe.test(a.url)) continue;
    const key = store.normalizeUrl(a.url);
    if (seen.has(key)) continue;
    seen.add(key);

    const title = a.title.replace(/--+>$/, '').trim();
    if (title.length < 8 || title.length > 90) continue;
    if (/^(更多|详情|下一页|上一页|返回|首页)$/.test(title)) continue;
    if (/政府信息公开指南|政府信息公开制度|政府信息公开年报|网站地图|无障碍/.test(title)) continue;
    if (isExcluded(title)) continue;
    if (!isCultural(title)) continue;
    if (source.titleFilter && !source.titleFilter.test(title)) continue;

    const publishedAt = require('./extract').guessDate({ url: a.url, title, context: a.context });
    picked.push({ title, url: a.url, publishedAt, context: a.context });
  }

  /* 新的在前；无日期的置于末尾，避免老旧文件挤占配额 */
  picked.sort((x, y) => {
    if (x.publishedAt && y.publishedAt) return x.publishedAt < y.publishedAt ? 1 : -1;
    if (x.publishedAt) return -1;
    if (y.publishedAt) return 1;
    return 0;
  });

  return picked;
}

/**
 * 执行一次同步
 * @param {(msg: string, level?: string) => void} onLog
 */
async function runSync(onLog = () => {}) {
  const startedAt = nowISO();
  const t0 = Date.now();

  const doc = store.loadPolicies();
  doc.items = doc.items || [];
  const index = store.buildIndex(doc.items);

  const runs = store.loadRuns();
  const run = {
    id: 'run-' + Date.now(),
    startedAt,
    finishedAt: null,
    durationMs: 0,
    trigger: 'manual',
    status: 'running',
    sources: [],
    totals: { newCount: 0, duplicateCount: 0, errorCount: 0, fetched: 0 }
  };

  const sourceState = store.readJson('sourcesState', { items: [] });

  for (const source of SOURCES.filter((s) => s.enabled)) {
    const s0 = Date.now();
    const item = {
      sourceId: source.id,
      name: source.name,
      regionCode: source.regionCode,
      status: 'running',
      fetched: 0,
      newCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      durationMs: 0,
      error: null
    };

    onLog(`开始同步：${source.name}`, 'info');

    try {
      const listUrls = (source.listUrls && source.listUrls.length) ? source.listUrls : [source.listUrl];
      const collected = [];
      const seenUrl = new Set();
      for (const listUrl of listUrls) {
        try {
          const listRes = await httpGet(listUrl, { referer: source.siteUrl, retries: 1 });
          for (const cand of selectCandidates(source, listRes.text, listUrl)) {
            const key = store.normalizeUrl(cand.url);
            if (seenUrl.has(key)) continue;
            seenUrl.add(key);
            collected.push(cand);
          }
        } catch (err) {
          onLog(`  分页抓取失败：${listUrl}（${err.message}）`, 'warn');
        }
        await sleep(250);
      }
      collected.sort((a, b) => {
        if (a.publishedAt && b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
        if (a.publishedAt) return -1;
        if (b.publishedAt) return 1;
        return 0;
      });
      const batch = collected.slice(0, source.maxItems);
      item.fetched = collected.length;
      onLog(`  解析到 ${collected.length} 条文化相关候选，本批处理 ${batch.length} 条`, 'muted');

      for (const cand of batch) {
        const probe = {
          title: cand.title,
          publishedAt: cand.publishedAt,
          officialUrl: cand.url,
          issuingAgency: source.organization
        };

        const existing = store.findExisting(index, probe);
        if (existing) {
          item.duplicateCount++;
          existing.lastCheckedAt = nowISO();
          continue;
        }

        try {
          const detailRes = await httpGet(cand.url, { referer: source.listUrl });
          const detail = parseDetail(detailRes.text, cand.url, cand.title);
          const policy = buildPolicy(source, cand, detail);

          if (!policy.summaryWhat) {
            policy.summaryWhat = policy.bodyExcerpt ? policy.bodyExcerpt.slice(0, 120) : null;
            policy.summaryReviewStatus = policy.summaryWhat ? 'pending' : 'draft';
          }

          doc.items.push(policy);
          store.registerInIndex(index, policy);
          item.newCount++;
          onLog(`  + ${policy.publishedAt || '日期待确认'} ${policy.title.slice(0, 34)}`, 'ok');
        } catch (err) {
          item.errorCount++;
          run.totals.errorCount++;
          onLog(`  ! 详情抓取失败：${cand.title.slice(0, 24)}（${err.message}）`, 'error');
        }
        await sleep(POLITE_DELAY_MS);
      }

      item.status = item.errorCount > 0 ? 'partial' : 'ok';
      onLog(`  完成：新增 ${item.newCount}，重复 ${item.duplicateCount}，失败 ${item.errorCount}`, item.status === 'ok' ? 'ok' : 'warn');
    } catch (err) {
      item.status = 'error';
      item.error = err.message;
      run.totals.errorCount++;
      onLog(`  来源失败：${err.message}`, 'error');
    }

    item.durationMs = Date.now() - s0;
    run.sources.push(item);
    run.totals.newCount += item.newCount;
    run.totals.duplicateCount += item.duplicateCount;
    run.totals.fetched += item.fetched;

    const prev = (sourceState.items || []).find((s) => s.sourceId === source.id) || { sourceId: source.id };
    prev.name = source.name;
    prev.regionCode = source.regionCode;
    prev.lastRunAt = nowISO();
    prev.lastStatus = item.status;
    if (item.status === 'error') {
      prev.lastErrorAt = nowISO();
      prev.lastErrorMessage = item.error;
    } else {
      prev.lastSuccessAt = nowISO();
      prev.lastErrorMessage = null;
    }
    sourceState.items = (sourceState.items || []).filter((s) => s.sourceId !== source.id);
    sourceState.items.push(prev);
    store.writeJson('sourcesState', sourceState);
  }

  run.finishedAt = nowISO();
  run.durationMs = Date.now() - t0;
  run.status = run.sources.every((s) => s.status === 'ok')
    ? 'success'
    : run.sources.every((s) => s.status === 'error')
      ? 'failed'
      : 'partial';

  doc.items.sort((a, b) => {
    const ap = a.publishedAt || '';
    const bp = b.publishedAt || '';
    return ap < bp ? 1 : ap > bp ? -1 : 0;
  });
  store.savePolicies(doc);

  runs.items = runs.items || [];
  runs.items.unshift(run);
  store.saveRuns(runs);

  onLog(`同步结束：新增 ${run.totals.newCount} 条，用时 ${(run.durationMs / 1000).toFixed(1)} 秒`, run.status === 'success' ? 'ok' : 'warn');
  return run;
}

module.exports = { runSync, REGION_NAMES };
