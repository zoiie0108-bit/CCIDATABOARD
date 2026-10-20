'use strict';

/* ============================================================
   文博周报采集（国家文物局 + 文化和旅游部统计公报）
   产物：data/heritage.json

   三类内容：
     1) weekly      ——「一周文物动态摘编」，每周 1 期，条目式动态流
     2) exhibitions ——「看展览 | 博物馆展讯速览」，每月 1 期，展览名录
     3) traffic     ——博物馆客流（假期 / 暑期口径，官方新闻稿）
     4) annual      ——年度底数（文旅部统计公报）

   用法：
     node server/collect-heritage.js
     node server/collect-heritage.js --pages 30   # 回溯更多列表页
   ============================================================ */

const fs = require('fs');
const path = require('path');

const { httpGet, sleep, stripTags, tidy, parseDetail } = require('./extract');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'heritage.json');

/* 国家文物局列表接口：dataproxy 每页约 100 条，可稳定翻页 */
const NCHA_COLUMN = 722; // 新闻资讯 > 文物新闻
const NCHA_PAGE_URL = (page) =>
  'http://www.ncha.gov.cn/module/jslib/jquery/jpage/dataproxy.jsp' +
  '?appid=1&appid=1&webid=1&path=/&columnid=' + NCHA_COLUMN +
  '&unitid=8000&webname=' + encodeURIComponent('国家文物局') +
  '&permissiontype=0&page=' + page;

/* 文旅部统计公报列表（jpaas 栏目，第一条分页带 index_3081.html） */
const MCT_BULLETIN_LIST = 'https://zwgk.mct.gov.cn/zfxxgkml/503/506/index_3081.html';

const WEEKLY_RE = /一周(?:各地)?文物动态摘编/;
const EXHIBITION_RE = /看展览/;
const TRAFFIC_RE = /博物馆.{0,12}(?:观众|接待)|接待观众|观众量|客流/;

/* 省级行政区简称：用于识别摘编里的地区小标题 */
const REGION_NAMES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏',
  '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西',
  '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏',
  '新疆', '香港', '澳门', '台湾'
];

/* ---------------- 通用解析 ---------------- */

/** 从 dataproxy 的 CDATA 记录里取文章标题与链接（单双引号都要支持） */
function parseRecords(html) {
  const out = [];
  const re = /href=['"]([^'"]*\/art\/(\d{4})\/(\d{1,2})\/[^'"]+)['"][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = tidy(m[4].replace(/<[^>]+>/g, '')).trim();
    if (!title) continue;
    out.push({
      title,
      url: m[1].replace(/^\//, 'http://www.ncha.gov.cn/'),
      year: Number(m[2]),
      month: Number(m[3])
    });
  }
  return out;
}

/** 取正文容器：优先 id=zoom，其次 ContentStart 之后 */
function contentHtml(html) {
  const i = html.indexOf('id=zoom');
  if (i >= 0) {
    const start = html.indexOf('>', i) + 1;
    const end = html.indexOf('</div>', start);
    if (end > start) return html.slice(start, end);
  }
  const m = html.match(/<meta name="ContentStart">([\s\S]*?)(?:<meta name="ContentEnd">|$)/i);
  return m ? m[1] : html;
}

/** 把正文拆成段落，并标出「整段就是一个 strong」与是否居中 */
function parseParagraphs(html) {
  const out = [];
  const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const text = tidy(stripTags(inner)).trim();
    const strongOnly = /^\s*<strong\b[^>]*>[\s\S]*<\/strong>\s*$/i.test(inner.replace(/<br\s*\/?>/gi, ''));
    const center = /text-align\s*:\s*center/i.test(attrs);
    if (!text && !/<img/i.test(inner)) continue;
    out.push({ text, strongOnly, center });
  }
  return out;
}

function normalizeLabel(text) {
  return String(text || '').replace(/[\s:：]/g, '');
}

function isRegionLabel(text) {
  const t = normalizeLabel(text);
  return t.length <= 3 && REGION_NAMES.includes(t);
}

/** 「10.10—10.16」这类期次标签 */
function periodFromTitle(title) {
  const m = String(title).match(/[（(]([^）)]*?\d{1,2}[.\-/月]\d{1,2}[^）)]*)[）)]/);
  return m ? m[1].replace(/\s+/g, '') : null;
}

/* ---------------- 三类内容解析 ---------------- */

/** 一周文物动态摘编：地区小标题 + 条目标题 + 首段摘要 */
function parseWeekly(html, page) {
  const paras = parseParagraphs(contentHtml(html));
  const items = [];
  let region = null;
  let current = null;

  for (const p of paras) {
    if (!p.text) continue;
    if (p.strongOnly) {
      if (isRegionLabel(p.text)) { region = normalizeLabel(p.text); continue; }
      current = { region, title: p.text, summary: '' };
      items.push(current);
      continue;
    }
    if (!current) continue;
    /* 每个条目只留首段，后续段落不追加，保持要点式长度 */
    if (!current.summary && p.text.length >= 12) {
      current.summary = p.text.length > 160 ? p.text.slice(0, 158) + '…' : p.text;
    }
  }

  return {
    period: periodFromTitle(page.title),
    title: page.title,
    publishedAt: page.publishedAt || null,
    url: page.url,
    items: items.filter((i) => i.title && i.title.length >= 6)
  };
}

/** 看展览 | 博物馆展讯速览：博物馆 / 展览 / 地点 / 时间 / 简介 */
function parseExhibitions(html, page) {
  const paras = parseParagraphs(contentHtml(html));
  const items = [];
  let museum = null;
  let current = null;

  for (const p of paras) {
    const raw = p.text;
    if (!raw) continue;
    const label = normalizeLabel(raw);

    if (p.center && p.strongOnly && !/^(地点|时间|简介)/.test(label)) {
      museum = raw;
      continue;
    }
    if (/^地点/.test(label)) { if (current) current.place = label.replace(/^地点/, ''); continue; }
    if (/^时间/.test(label)) { if (current) current.time = label.replace(/^时间/, ''); continue; }
    if (/^简介/.test(label)) {
      if (current) {
        const intro = label.replace(/^简介/, '');
        current.intro = intro.length > 200 ? intro.slice(0, 198) + '…' : intro;
      }
      continue;
    }
    if (p.strongOnly) {
      current = { museum, exhibition: raw, place: '', time: '', intro: '' };
      items.push(current);
    }
  }

  return {
    issue: page.publishedAt || null,
    title: page.title,
    publishedAt: page.publishedAt || null,
    url: page.url,
    items: items.filter((i) => i.exhibition && i.exhibition.length >= 4)
  };
}

/** 博物馆客流：标题里带期间，正文里取总量与同比 */
const TRAFFIC_RULES = [
  { re: /([\d.]+)\s*亿人次/, unit: '亿人次', scale: 1 },
  { re: /([\d,]+(?:\.\d+)?)\s*万人次/, unit: '万人次', scale: 1 }
];

function parseTraffic(html, page) {
  const text = tidy(stripTags(contentHtml(html))).replace(/\s+/g, '');
  if (!/博物馆|文博/.test(text) || !/接待|观众/.test(text)) return null;

  /* 只认「全国…接待观众 X」这种全国口径句，避免抓到单馆数据 */
  const sentence = (text.match(/[^。；]{0,30}全国[^。；]{0,60}(?:接待|参观)[^。；]{0,40}(?:亿人次|万人次)[^。；]{0,60}/g) || [])[0];
  if (!sentence) return null;

  let value = null;
  let unit = null;
  for (const rule of TRAFFIC_RULES) {
    const m = sentence.match(rule.re);
    if (!m) continue;
    value = Math.round(Number(m[1].replace(/,/g, '')) * rule.scale * 100) / 100;
    unit = rule.unit;
    break;
  }
  if (value == null) return null;

  const yoyMatch = sentence.match(/同比(?:增长|下降)?\s*(-?\d+(?:\.\d+)?)\s*%/);
  const dailyYoy = text.match(/日均[^。]{0,10}(?:增长|下降)\s*(-?\d+(?:\.\d+)?)\s*%/);

  return {
    period: trafficPeriod(page.title, sentence, page.publishedAt),
    value,
    unit,
    /* 统一折算成万人次，便于跨年份对照；展示时仍保留官方原单位 */
    valueWan: unit === '亿人次' ? Math.round(value * 10000 * 100) / 100 : value,
    yoy: yoyMatch ? Number(yoyMatch[1]) : null,
    dailyYoy: dailyYoy ? Number(dailyYoy[1]) : null,
    publishedAt: page.publishedAt || null,
    url: page.url,
    title: page.title,
    snippet: sentence.slice(0, 160),
    note: dailyYoy ? '该期同时给出日均口径；假期天数不同时应看日均。' : null
  };
}

const HOLIDAY_WORDS = '暑期|春节|国庆|五一|元旦|清明|端午|中秋|寒假';

function trafficPeriod(title, sentence, publishedAt) {
  const fromText = String(sentence || '').match(new RegExp('(20\\d{2})年(' + HOLIDAY_WORDS + ')'));
  if (fromText) return fromText[1] + ' ' + fromText[2];

  const fromTitle = String(title || '').match(new RegExp('(20\\d{2})年(' + HOLIDAY_WORDS + ')'));
  if (fromTitle) return fromTitle[1] + ' ' + fromTitle[2];

  /* 「今年暑期」「春节假期」这类写法，用发布年份补齐 */
  const relative = String(title || '').match(new RegExp('(?:今年|全年)?(' + HOLIDAY_WORDS + ')'));
  const year = String(publishedAt || '').slice(0, 4);
  if (relative && year) return year + ' ' + relative[1];

  /* 标题与正文都没写假期名（如「8天假期…6600万人次」）时，按发布日期落在哪个假期推断 */
  const md = String(publishedAt || '').slice(5, 10);
  if (year && md) {
    const [mm, dd] = md.split('-').map(Number);
    if (mm === 10 && dd <= 15) return year + ' 国庆';
    if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 25)) return year + ' 春节';
    if ((mm === 7 || mm === 8) || (mm === 9 && dd <= 10)) return year + ' 暑期';
    if ((mm === 4 && dd >= 25) || (mm === 5 && dd <= 10)) return year + ' 五一';
    if (mm === 6) return year + ' 端午';
  }

  return null;
}

/* 年度底数：文旅部统计公报 */
function parseBulletin(html, page) {
  const text = tidy(stripTags(contentHtml(html))).replace(/\s+/g, '');
  const yearMatch = page.title.match(/(20\d{2})年/);
  if (!yearMatch) return null;

  const num = (re, idx = 1) => {
    const m = text.match(re);
    return m ? Number(String(m[idx]).replace(/,/g, '')) : null;
  };

  const museums = num(/登记备案博物馆、纪念馆(?:达到|共有)?\s*(\d+)\s*个/);
  const institutions = num(/各类文物机构\s*(\d+)\s*个/);
  const exhibitions = num(/举办陈列展览\s*(\d+(?:\.\d+)?)\s*万个/);
  const collections = num(/文物机构藏品\s*(\d+(?:\.\d+)?)\s*万件/);

  /* 接待观众与未成年人观众：早期公报用万人次，统一折算成亿人次便于跨年比较 */
  const toYi = (m) => {
    if (!m) return null;
    const raw = Number(String(m[1]).replace(/,/g, ''));
    if (!isFinite(raw)) return null;
    return m[2] === '万' ? Math.round((raw / 10000) * 100) / 100 : Math.round(raw * 100) / 100;
  };
  const visitsMatch = text.match(/接待观众\s*([\d,]+(?:\.\d+)?)\s*(亿|万)人次/);
  const visits = toYi(visitsMatch);
  const visitsYoy = num(/接待观众\s*[\d,]+(?:\.\d+)?\s*(?:亿|万)人次[，,]\s*同比增长\s*(\d+(?:\.\d+)?)\s*%/);
  const minorsMatch = text.match(/未成年人\s*([\d,]+(?:\.\d+)?)\s*(亿|万)人次/);
  const minors = toYi(minorsMatch);

  if (museums == null && visits == null) return null;

  return {
    year: Number(yearMatch[1]),
    museums,
    institutions,
    visits,
    visitsUnit: '亿人次',
    visitsYoy,
    minors,
    exhibitions,
    collections,
    publishedAt: page.publishedAt || null,
    sourceName: '文化和旅游部 · 文化和旅游发展统计公报',
    url: page.url
  };
}

/* ---------------- 主流程 ---------------- */

async function fetchDetail(url, referer, fallbackTitle) {
  const res = await httpGet(url, { referer, retries: 1 });
  const detail = parseDetail(res.text, url, fallbackTitle);
  return { html: res.text, detail };
}

async function collectNcha(maxPages, limits) {
  const weekly = [];
  const exhibitions = [];
  const traffic = [];

  /* 阶段一：只扫列表（每页约 300 条，成本极低），把三类目标挑出来 */
  const candidates = { weekly: [], exhibitions: [], traffic: [] };
  const seen = new Set();

  /* 列表本身很便宜（每页约 300 条），回溯 4 年以便拿到往年假期客流做对照 */
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 48);
  const cutoffKey = cutoff.getFullYear() * 100 + (cutoff.getMonth() + 1);

  let scanned = 0;
  for (let page = 1; page <= maxPages; page++) {
    let html;
    try {
      const res = await httpGet(NCHA_PAGE_URL(page), { retries: 1 });
      html = res.text;
    } catch (err) {
      console.log(`  列表第 ${page} 页失败：${err.message}`);
      break;
    }
    const records = parseRecords(html);
    if (!records.length) break;
    scanned += records.length;

    for (const rec of records) {
      if (seen.has(rec.url)) continue;
      seen.add(rec.url);
      const key = WEEKLY_RE.test(rec.title) ? 'weekly' : EXHIBITION_RE.test(rec.title) ? 'exhibitions' : TRAFFIC_RE.test(rec.title) ? 'traffic' : null;
      if (key) candidates[key].push(rec);
    }

    const oldest = records.reduce((acc, r) => Math.min(acc, r.year * 100 + r.month), 999999);
    if (oldest < cutoffKey) break;
    await sleep(250);
  }

  console.log(`  列表共扫描 ${scanned} 条，候选：周报 ${candidates.weekly.length} / 展讯 ${candidates.exhibitions.length} / 客流 ${candidates.traffic.length}`);

  /* 阶段二：只抓需要的详情。客流条目稀少且价值高，全部抓；周报与展讯只取最近若干期 */
  const plan = [
    { type: 'weekly', list: candidates.weekly.slice(0, limits.weekly), label: '周报' },
    { type: 'exhibitions', list: candidates.exhibitions.slice(0, limits.exhibitions), label: '展讯' },
    { type: 'traffic', list: candidates.traffic, label: '客流' }
  ];

  for (const step of plan) {
    for (const rec of step.list) {
      let got;
      try {
        got = await fetchDetail(rec.url, 'http://www.ncha.gov.cn/', rec.title);
      } catch (err) {
        console.log(`  ${step.label}详情失败：${rec.title.slice(0, 20)}`);
        continue;
      }
      const pageInfo = {
        title: rec.title,
        publishedAt: got.detail.publishedAt,
        url: rec.url
      };

      if (step.type === 'weekly') {
        const w = parseWeekly(got.html, pageInfo);
        /* 详情页标题常被截断在破折号处，期次优先用列表标题解析 */
        w.period = w.period || periodFromTitle(rec.title);
        if (w.items.length) weekly.push(w);
        console.log(`  周报 ${w.period || '期间未知'}：${w.items.length} 条`);
      } else if (step.type === 'exhibitions') {
        const e = parseExhibitions(got.html, pageInfo);
        if (e.items.length) exhibitions.push(e);
        console.log(`  展讯 ${(e.issue || '').slice(0, 10)}：${e.items.length} 个展览`);
      } else {
        const t = parseTraffic(got.html, pageInfo);
        if (t) {
          traffic.push(t);
          console.log(`  客流 ${t.period || '期间未知'}：${t.value} ${t.unit}`);
        }
      }
      await sleep(350);
    }
  }

  return { weekly, exhibitions, traffic };
}

async function collectBulletins(limit) {
  const out = [];
  let html;
  try {
    const res = await httpGet(MCT_BULLETIN_LIST, { retries: 1 });
    html = res.text;
  } catch (err) {
    console.log(`  统计公报列表失败：${err.message}`);
    return out;
  }

  const links = [];
  const re = /<a[^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]{0,80}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = tidy(stripTags(m[2])).trim();
    if (!/20\d{2}年文化和旅游发展统计公报/.test(title)) continue;
    let url;
    try {
      url = new URL(m[1], MCT_BULLETIN_LIST).href;
    } catch (err) {
      continue;
    }
    if (links.some((x) => x.url === url)) continue;
    links.push({ title, url });
  }

  for (const link of links.slice(0, limit)) {
    try {
      const got = await fetchDetail(link.url, MCT_BULLETIN_LIST, link.title);
      const row = parseBulletin(got.html, {
        title: got.detail.title || link.title,
        publishedAt: got.detail.publishedAt,
        url: link.url
      });
      if (row) {
        out.push(row);
        console.log(`  年度底数 ${row.year}：博物馆 ${row.museums ?? '—'} 个，接待观众 ${row.visits ?? '—'} 亿人次`);
      }
    } catch (err) {
      console.log(`  公报失败：${link.title.slice(0, 24)}`);
    }
    await sleep(350);
  }
  return out;
}

/** 与已有归档合并：新抓到的优先，旧的保留，避免每次运行丢掉历史期次 */
function mergeArchive(previous, incoming, keyOf) {
  const map = new Map();
  for (const item of previous || []) {
    const k = keyOf(item);
    if (k != null) map.set(k, item);
  }
  for (const item of incoming || []) {
    const k = keyOf(item);
    if (k != null) map.set(k, item);
  }
  return [...map.values()];
}

function sortByDateDesc(list, field) {
  return list
    .slice()
    .sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
}

function loadPrevious() {
  try {
    if (!fs.existsSync(OUT)) return null;
    const raw = fs.readFileSync(OUT, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.log(`  已有归档读取失败（将重新生成）：${err.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const pagesArg = args.indexOf('--pages');
  const maxPages = pagesArg >= 0 ? Math.max(1, Number(args[pagesArg + 1]) || 40) : 40;
  const weeklyArg = args.indexOf('--weekly');
  const weeklyLimit = weeklyArg >= 0 ? Math.max(1, Number(args[weeklyArg + 1]) || 12) : 12;
  const exhArg = args.indexOf('--exhibitions');
  const exhibitionLimit = exhArg >= 0 ? Math.max(1, Number(args[exhArg + 1]) || 6) : 6;

  console.log('采集国家文物局：周报 / 展讯 / 客流');
  const ncha = await collectNcha(maxPages, { weekly: weeklyLimit, exhibitions: exhibitionLimit });

  console.log('采集文化和旅游部统计公报：年度底数');
  const annual = await collectBulletins(6);

  const previous = loadPrevious();

  const doc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sources: [
      { id: 'ncha-722', name: '国家文物局 · 文物新闻', url: 'http://www.ncha.gov.cn/col/col722/index.html', level: '官方' },
      { id: 'mct-bulletin', name: '文化和旅游部 · 统计公报', url: MCT_BULLETIN_LIST, level: '官方' }
    ],
    /* 用原文链接作为合并键：期间标签是解析出来的，可能随规则改进而变化 */
    weekly: sortByDateDesc(mergeArchive(previous && previous.weekly, ncha.weekly, (w) => w.url), 'publishedAt'),
    exhibitions: sortByDateDesc(mergeArchive(previous && previous.exhibitions, ncha.exhibitions, (e) => e.url), 'publishedAt'),
    traffic: sortByDateDesc(mergeArchive(previous && previous.traffic, ncha.traffic, (t) => t.url), 'publishedAt'),
    annual: mergeArchive(previous && previous.annual, annual, (a) => String(a.year)).sort((a, b) => b.year - a.year)
  };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2), 'utf8');

  console.log('');
  console.log(`采集完成：周报 ${doc.weekly.length} 期，展讯 ${doc.exhibitions.length} 期，客流 ${doc.traffic.length} 条，年度 ${doc.annual.length} 年`);
  console.log(`已写入 ${OUT}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('采集失败：', err);
    process.exit(1);
  });
}

module.exports = { parseRecords, parseWeekly, parseExhibitions, parseTraffic, parseBulletin, contentHtml };
