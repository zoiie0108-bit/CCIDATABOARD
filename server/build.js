'use strict';

/* ============================================================
   构建静态看板
   用法：
     node server/build.js           # 先抓取，再构建
     node server/build.js --no-sync # 只用现有数据构建
   输出：dist/index.html（单文件，数据内嵌，可部署到任意静态托管）
   ============================================================ */

const fs = require('fs');
const path = require('path');

const store = require('./store');
const { ensureSeed } = require('./seed');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'web', 'template.html');
const DIST = path.join(ROOT, 'dist');

const REGIONS = ['national', 'zhejiang', 'beijing', 'shanghai', 'hangzhou'];

/* 只保留前端需要的字段，避免把正文快照写进 HTML */
function trimPolicy(p) {
  return {
    id: p.id,
    title: p.title,
    regionCode: p.regionCode,
    issuingAgency: p.issuingAgency,
    documentNumber: p.documentNumber,
    publishedAt: p.publishedAt,
    documentType: p.documentType,
    isKeyPolicy: Boolean(p.isKeyPolicy),
    topicTags: p.topicTags || [],
    toolTags: p.toolTags || [],
    summaryWhat: p.summaryWhat || null,
    officialUrl: p.officialUrl,
    sourceName: p.sourceName || null
  };
}

function sortPolicies(a, b) {
  if (a.isKeyPolicy !== b.isKeyPolicy) return a.isKeyPolicy ? -1 : 1;
  const ap = a.publishedAt || '';
  const bp = b.publishedAt || '';
  if (ap !== bp) return ap < bp ? 1 : -1;
  return a.title < b.title ? -1 : 1;
}

function buildData() {
  ensureSeed();

  const policiesDoc = store.loadPolicies();
  const indicatorsDoc = store.loadIndicators();
  const runsDoc = store.loadRuns();
  const heritageDoc = store.readJson('heritage.json', null);

  const published = (policiesDoc.items || []).filter((p) => p.visibilityStatus === 'published');
  const policies = published.map(trimPolicy).sort(sortPolicies);
  const indicators = (indicatorsDoc.items || []).map(trimIndicator);

  const regions = REGIONS.reduce((acc, code) => {
    acc[code] = policies.filter((p) => p.regionCode === code).length;
    return acc;
  }, {});

  const lastRun = (runsDoc.items || [])[0] || null;
  const heritage = trimHeritage(heritageDoc);

  const stats = {
    totalPolicies: policies.length,
    keyPolicies: policies.filter((p) => p.isKeyPolicy).length,
    regions,
    indicators: indicators.length,
    indicatorsFilm: indicators.filter((i) => i.group === 'film').length,
    indicatorsTourism: indicators.filter((i) => i.group === 'tourism').length,
    indicatorsMissing: indicators.filter((i) => i.dataStatus === 'missing').length,
    indicatorsOfficial: indicators.filter((i) => i.sourceLevel === '官方').length,
    indicatorsStale: indicators.filter((i) => i.freshness === 'stale').length,
    heritageWeekly: heritage ? heritage.weeklyTotal : 0,
    heritageExhibitions: heritage ? heritage.exhibitions.reduce((n, e) => n + e.items.length, 0) : 0,
    heritageTraffic: heritage ? heritage.traffic.length : 0
  };

  return {
    generatedAt: new Date().toISOString(),
    lastSyncAt: lastRun ? lastRun.finishedAt || lastRun.startedAt : null,
    stats,
    policies,
    indicators,
    heritage
  };
}

/* 新鲜度：按发布日期距今计算；无发布日则 unknown */
function freshnessOf(publishedAt, now) {
  if (!publishedAt) return 'unknown';
  const days = Math.floor((now - new Date(publishedAt + 'T00:00:00Z')) / 86400000);
  if (days < 0) return 'fresh';
  if (days <= 30) return 'fresh';
  if (days <= 60) return 'aging';
  return 'stale';
}

/* 期间排序：先按年份，再按期间在年内的先后（季度 < 半年 < 前三季度 < 年度） */
function periodOrder(period) {
  const s = String(period || '');
  const y = s.match(/(20\d{2})/);
  if (!y) return 99999999;
  const base = Number(y[1]) * 100;
  const ranks = [
    [/一季度/, 1], [/上半年/, 2], [/前三季度/, 3], [/年度|全年/, 4],
    [/元旦|贺岁/, 0], [/春节/, 1], [/清明/, 2], [/五一/, 3], [/端午/, 4],
    [/暑期/, 5], [/中秋/, 6], [/国庆/, 7]
  ];
  for (const [re, r] of ranks) if (re.test(s)) return base + r;
  const m = s.match(/年\s*(\d{1,2})\s*月/);
  if (m) return base + Number(m[1]);
  return base + 9;
}

function trimIndicator(i) {
  const now = new Date();
  const seen = new Set();
  const history = (Array.isArray(i.history) ? i.history : [])
    .filter((h) => {
      const key = String(h.period || '').replace(/\s+/g, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => periodOrder(a.period) - periodOrder(b.period) ||
      String(a.publishedAt || '').localeCompare(String(b.publishedAt || '')));
  return {
    id: i.id,
    code: i.code,
    name: i.name,
    group: i.group,
    regionCode: i.regionCode,
    unit: i.unit,
    frequency: i.frequency || null,
    period: i.period || null,
    value: i.value == null ? null : i.value,
    valueLabel: i.valueLabel || null,
    yoy: i.yoy == null ? null : i.yoy,
    comparison: i.comparison || null,
    publishedAt: i.publishedAt || null,
    nextRelease: i.nextRelease || null,
    freshness: freshnessOf(i.publishedAt, now),
    caliber: i.caliber || null,
    formula: i.formula || null,
    sourceName: i.sourceName || null,
    sourceLevel: i.sourceLevel || '官方',
    sourceUrl: i.sourceUrl || null,
    display: i.display || 'detail',
    dataStatus: i.dataStatus || 'reported',
    history: history.map((h) => ({
      period: h.period,
      value: h.value,
      yoy: h.yoy == null ? null : h.yoy,
      publishedAt: h.publishedAt || null
    })),
    trendBasis: i.trendBasis === 'yoy' ? 'yoy' : (i.trendBasis === 'none' ? 'none' : 'value'),
    historyNote: i.historyNote || null
  };
}

/* 文博周报：只保留前端展示需要的字段，并限制期数以控制单文件体积 */
function trimHeritage(doc, limits) {
  if (!doc) return null;
  const lim = limits || { weekly: 6, exhibitions: 2 };

  const weekly = (doc.weekly || []).slice(0, lim.weekly).map((w) => ({
    period: w.period || null,
    publishedAt: w.publishedAt || null,
    url: w.url,
    itemCount: (w.items || []).length,
    items: (w.items || []).map((i) => ({
      region: i.region || null,
      title: i.title,
      summary: i.summary || null
    }))
  }));

  const exhibitions = (doc.exhibitions || []).slice(0, lim.exhibitions).map((e) => ({
    issue: e.issue || e.publishedAt || null,
    publishedAt: e.publishedAt || null,
    url: e.url,
    itemCount: (e.items || []).length,
    items: (e.items || []).map((i) => ({
      museum: i.museum || null,
      exhibition: i.exhibition,
      place: i.place || null,
      time: i.time || null,
      intro: i.intro ? (i.intro.length > 150 ? i.intro.slice(0, 148) + '…' : i.intro) : null
    }))
  }));

  return {
    updatedAt: doc.updatedAt || null,
    sources: doc.sources || [],
    weekly,
    weeklyTotal: (doc.weekly || []).length,
    exhibitions,
    exhibitionsTotal: (doc.exhibitions || []).length,
    traffic: (doc.traffic || []).map((t) => ({
      period: t.period || null,
      value: t.value,
      unit: t.unit,
      valueWan: t.valueWan == null ? null : t.valueWan,
      yoy: t.yoy == null ? null : t.yoy,
      dailyYoy: t.dailyYoy == null ? null : t.dailyYoy,
      publishedAt: t.publishedAt || null,
      url: t.url,
      note: t.note || null
    })),
    annual: (doc.annual || []).map((a) => ({
      year: a.year,
      museums: a.museums == null ? null : a.museums,
      institutions: a.institutions == null ? null : a.institutions,
      visits: a.visits == null ? null : a.visits,
      visitsYoy: a.visitsYoy == null ? null : a.visitsYoy,
      minors: a.minors == null ? null : a.minors,
      exhibitions: a.exhibitions == null ? null : a.exhibitions,
      publishedAt: a.publishedAt || null,
      url: a.url
    }))
  };
}

function renderHtml(data) {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const json = JSON.stringify(data)
    /* 防止数据里的 </script> 提前闭合标签 */
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  if (!template.includes('__DATA__')) throw new Error('模板缺少 __DATA__ 占位符');
  return template.replace('__DATA__', json);
}

function writeOutput(html, data) {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  const target = path.join(DIST, 'index.html');
  fs.writeFileSync(target, html, 'utf8');
  fs.writeFileSync(path.join(DIST, 'data.json'), JSON.stringify(data, null, 2), 'utf8');
  return target;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldSync = !args.includes('--no-sync');
  const shouldHeritage = !args.includes('--no-heritage');

  if (shouldSync) {
    const { runSync } = require('./sync');
    console.log('开始抓取官方栏目…');
    const run = await runSync((msg) => console.log(msg));
    console.log(`抓取完成：新增 ${run.totals.newCount}，重复 ${run.totals.duplicateCount}，失败 ${run.totals.errorCount}`);
  } else {
    console.log('跳过抓取，使用现有数据构建。');
  }

  if (shouldSync && shouldHeritage) {
    console.log('');
    console.log('开始采集文博周报…');
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync(process.execPath, [path.join(__dirname, 'collect-heritage.js')], {
        encoding: 'utf8'
      });
      const lines = out.trim().split('\n');
      console.log(lines[lines.length - 2] || lines[lines.length - 1]);
    } catch (err) {
      /* 文博采集失败不应阻断政策与指标的构建 */
      console.log(`文博采集失败，沿用 data/heritage.json：${String(err.message).split('\n')[0]}`);
    }
  }

  const data = buildData();
  const html = renderHtml(data);
  const target = writeOutput(html, data);

  console.log('');
  console.log('构建完成');
  console.log(`  文件：${target}`);
  console.log(`  大小：${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
  console.log(`  政策：${data.stats.totalPolicies} 条（重点 ${data.stats.keyPolicies} 条）`);
  console.log(`  指标：${data.stats.indicators} 条`);
  if (data.heritage) {
    console.log(`  文博周报：${data.stats.heritageWeekly} 期 / 展览 ${data.stats.heritageExhibitions} 个`);
  }
  console.log('');
  console.log('直接打开 dist/index.html 即可查看，或放到任意静态托管。');
}

main().catch((err) => {
  console.error('构建失败：', err);
  process.exit(1);
});
