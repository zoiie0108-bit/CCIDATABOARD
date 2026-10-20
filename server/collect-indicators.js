'use strict';

/* ============================================================
   指标候选采集（M2 半自动）
   流程：抓官方新闻列表 → 命中指标关键词 → 抓正文 → 抽取数字 → 产出待确认清单
   产物：data/indicator-candidates.json / .csv
   CSV 中把 accept 改成 Y 后，运行 node server/promote.js 合并
   ============================================================ */

const fs = require('fs');
const path = require('path');

const { httpGet, sleep, parseAnchors, parseDetail, stripTags, tidy } = require('./extract');
const store = require('./store');

const DATA_DIR = path.join(__dirname, '..', 'data');

/* 指标来源：只登记官方发布渠道 */
const INDICATOR_SOURCES = [
  {
    id: 'cn-film-gzdt',
    name: '国家电影局 · 工作动态',
    listUrl: 'https://www.chinafilm.gov.cn/xwzx/gzdt/',
    siteUrl: 'https://www.chinafilm.gov.cn/',
    articleRe: /t\d{8}_\d+\.html/i,
    maxItems: 12
  },
  {
    id: 'cn-film-hyzx',
    name: '国家电影局 · 行业资讯',
    listUrl: 'https://www.chinafilm.gov.cn/xwzx/hyzx/',
    siteUrl: 'https://www.chinafilm.gov.cn/',
    articleRe: /t\d{8}_\d+\.html/i,
    maxItems: 12
  },
  {
    id: 'cn-mct-ywxx',
    name: '文化和旅游部 · 要闻信息',
    listUrl: 'https://www.mct.gov.cn/whzx/whyw/',
    /* 节假日出游数据按假期发布，翻多页才能拿到跨年度的可比序列 */
    listUrls: ['https://www.mct.gov.cn/whzx/whyw/'].concat(
      Array.from({ length: 8 }, (_, i) => `https://www.mct.gov.cn/whzx/whyw/index_${i + 1}.htm`)
    ),
    siteUrl: 'https://www.mct.gov.cn/',
    articleRe: /t\d{8}_\d+\.html?/i,
    maxItems: 12
  },
  {
    id: 'cn-stats-zxfb',
    name: '国家统计局 · 最新发布',
    listUrl: 'https://www.stats.gov.cn/sj/zxfb/',
    /* 文化产业季度数据分散在多页，翻到约两年前的发布 */
    listUrls: ['https://www.stats.gov.cn/sj/zxfb/'].concat(
      Array.from({ length: 36 }, (_, i) => `https://www.stats.gov.cn/sj/zxfb/index_${i + 1}.html`)
    ),
    siteUrl: 'https://www.stats.gov.cn/',
    articleRe: /t\d{8}_\d+\.html/i,
    titleRe: /文化及相关产业|文化产业/,
    maxItems: 24
  },
  /* 地方票房：地方主管部门无固定数据栏目，改为扫其新闻栏目，命中「<地区>…票房…亿元」即产出候选 */
  {
    id: 'region-bj-gov',
    name: '北京市政府 · 政务动态',
    listUrl: 'https://www.beijing.gov.cn/ywdt/gzdt/',
    siteUrl: 'https://www.beijing.gov.cn/',
    articleRe: /t\d{8}_\d+\.html/i,
    titleRe: /票房|电影市场/,
    maxItems: 6
  },
  {
    id: 'region-sh-whlj',
    name: '上海市文化和旅游局 · 文旅要闻',
    listUrl: 'https://whlyj.sh.gov.cn/wlyw/',
    siteUrl: 'https://whlyj.sh.gov.cn/',
    articleRe: /\/wlyw\/\d{8}\/[0-9a-f]+/i,
    titleRe: /票房|电影市场/,
    maxItems: 6
  },
  {
    id: 'region-hz-wgly',
    name: '杭州市文化广电旅游局 · 门户文章',
    listUrl: 'https://wgly.hangzhou.gov.cn/',
    siteUrl: 'https://wgly.hangzhou.gov.cn/',
    articleRe: /\/art\/|art_\d+\.html/i,
    titleRe: /票房|电影市场/,
    maxItems: 6
  },
  {
    id: 'region-zj-ct',
    name: '浙江省文化广电和旅游厅 · 首页文章',
    listUrl: 'https://ct.zj.gov.cn/',
    siteUrl: 'https://ct.zj.gov.cn/',
    articleRe: /art_\d+\.html/i,
    titleRe: /票房|电影市场/,
    maxItems: 6
  }
];

/* 地方票房识别：句子同时出现地区名与票房数值才产出候选 */
const REGION_RULES = [
  { code: 'ZJ_BOX_OFFICE', name: '浙江省电影票房', test: /浙江/ },
  { code: 'HZ_BOX_OFFICE', name: '杭州市电影票房', test: /杭州/ },
  { code: 'BJ_BOX_OFFICE', name: '北京市电影票房', test: /北京/ },
  { code: 'SH_BOX_OFFICE', name: '上海市电影票房', test: /上海/ }
];

/* 标题命中规则：决定去看哪类文章 */
const TITLE_HINTS = /票房|观影人次|银幕|出游|假期|旅游收入|旅游花费|演出|艺术品|文化企业|营业收入|统计公报|统计快报|数据|同比/;

/* 指标匹配规则：按优先级从高到低 */
const MATCHERS = [
  { code: 'CN_BOX_SUMMER', name: '全国暑期档票房', test: /暑期档/, unit: '亿元', kind: 'box' },
  { code: 'CN_BOX_HOLIDAY', name: '全国档期电影票房', test: /(春节档|国庆档|五一档|元旦档|清明档|端午档|中秋档|贺岁档|档期)/, unit: '亿元', kind: 'box' },
  { code: 'CN_BOX_ANNUAL', name: '全国年度电影票房', test: /(年度|全年).{0,8}票房|票房.{0,6}(年度|全年)/, unit: '亿元', kind: 'box' },
  { code: 'CN_ADMISSIONS', name: '全国档期观影人次', test: /观影人次|观影人数/, unit: '万人次', kind: 'admissions' },
  { code: 'CN_SCREENS', name: '全国银幕总数', test: /银幕/, unit: '块', kind: 'screens' },
  { code: 'CN_TRAVEL_TRIPS', name: '全国国内出游人次', test: /出游|国内旅游人次/, unit: '亿人次', kind: 'trips' },
  { code: 'CN_TRAVEL_SPEND', name: '全国国内出游总花费', test: /旅游.*(花费|收入|消费)|出游.*(花费|总花费)/, unit: '亿元', kind: 'spend' },
  { code: 'CN_MAJOR_SHOWS', name: '全国大型演出场次', test: /演出.*场次|大型演出/, unit: '场', kind: 'shows' },
  { code: 'CN_CULTURE_REV', name: '规模以上文化及相关产业企业营业收入', test: /文化.*(企业).*营业收入|规模以上文化/, unit: '亿元', kind: 'rev' },
  { code: 'CN_NEW_FORMAT_REV', name: '文化新业态营业收入', test: /文化新业态/, unit: '亿元', kind: 'rev' },
  { code: 'CN_CULTURE_PROFIT', name: '规模以上文化企业利润总额', test: /利润总额/, unit: '亿元', kind: 'profit' },
  { code: 'CN_CONTENT_PROD_REV', name: '内容创作生产营业收入', test: /内容创作生产/, unit: '亿元', kind: 'rev' }
];

/* 数字抽取：按关键词就近取值，避免抽到句子里无关的数字 */
const ANCHORS = {
  box: [
    { re: /(?:档期|暑期档|国庆档|春节档|五一档|年度|全年|总)?票房[^0-9]{0,10}([\d,]+(?:\.\d+)?)\s*亿元/, unit: '亿元', scale: 1 },
    { re: /([\d,]+(?:\.\d+)?)\s*亿元[^。]{0,6}票房/, unit: '亿元', scale: 1 }
  ],
  admissions: [
    { re: /观影人次[^0-9]{0,10}([\d,]+(?:\.\d+)?)\s*亿/, unit: '万人次', scale: 10000 },
    { re: /观影人次[^0-9]{0,10}([\d,]+(?:\.\d+)?)\s*万/, unit: '万人次', scale: 1 },
    { re: /观影人次[^0-9]{0,10}([\d,]+(?:\.\d+)?)\s*人次/, unit: '万人次', scale: 0.0001 }
  ],
  screens: [
    { re: /银幕(?:总数|总量|数量)?[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*万块/, unit: '块', scale: 10000 },
    { re: /银幕(?:总数|总量|数量)?[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*块/, unit: '块', scale: 1 }
  ],
  trips: [
    { re: /(?:出游|国内旅游)[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*亿人次/, unit: '亿人次', scale: 1 },
    { re: /(?:出游|国内旅游)[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*万人次/, unit: '万人次', scale: 1 }
  ],
  spend: [
    { re: /(?:花费|收入|消费)[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*亿元/, unit: '亿元', scale: 1 },
    { re: /([\d,]+(?:\.\d+)?)\s*亿元[^。]{0,8}(?:花费|收入)/, unit: '亿元', scale: 1 }
  ],
  shows: [
    { re: /([\d,]+)\s*场/, unit: '场', scale: 1 }
  ],
  rev: [
    { re: /营业收入[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*亿元/, unit: '亿元', scale: 1 },
    { re: /([\d,]+(?:\.\d+)?)\s*亿元/, unit: '亿元', scale: 1 }
  ],
  profit: [
    { re: /利润总额[^0-9]{0,12}([\d,]+(?:\.\d+)?)\s*亿元/, unit: '亿元', scale: 1 }
  ]
};

const PERIOD_RES = [
  /(20\d{2})年[“"']?(春节|国庆|五一|元旦|清明|端午|中秋|暑期|贺岁)[”"']?(?:节)?(?:假期|档)?/,
  /(20\d{2})年(\d{1,2})月份?/,
  /(20\d{2})年(第[一二三四]季度|一季度|二季度|三季度|四季度|上半年|前三季度|全年)/,
  /(20\d{2})年(?:全国|我国|度)/
];

function guessPeriod(text) {
  for (const re of PERIOD_RES) {
    const m = text.match(re);
    if (m) {
      const label = m[0].replace(/\s+/g, '');
      /* 「2025年全国…」这类写法补成年度口径 */
      if (/^\d{4}年(全国|我国|度)$/.test(label)) return label.slice(0, 4) + '年度';
      return label;
    }
  }
  return null;
}

function guessYoy(text) {
  const m = text.match(/(?:同比|增长|下降|较上年)\s*(?:增长|下降)?\s*(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const v = Number(m[1]);
  return /下降|减少/.test(text.slice(Math.max(0, m.index - 8), m.index + 8)) ? -Math.abs(v) : v;
}

/* 累计口径（截至X月、全年、总票房）不是档期值，抽到就必须丢弃 */
const CUMULATIVE_RE = /截至|累计|全年|年初至今|总票房|总计|截至目前/;

function pickNumber(sentence, kind) {
  const rules = ANCHORS[kind] || [];
  for (const rule of rules) {
    const m = sentence.match(rule.re);
    if (!m) continue;
    const before = sentence.slice(Math.max(0, m.index - 30), m.index);
    if (CUMULATIVE_RE.test(before)) continue;
    const raw = Number(m[1].replace(/,/g, ''));
    if (!isFinite(raw)) continue;
    const value = Math.round(raw * rule.scale * 100) / 100;
    return { value, unit: rule.unit };
  }
  return null;
}

function findSentences(text, matcher) {
  const sentences = tidy(stripTags(text))
    .split(/(?<=[。！？；])|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 220);

  return sentences.filter((s) => matcher.test(s));
}

function csvEscape(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

async function collect(onLog = () => {}) {
  const candidates = [];
  const seen = new Set();

  for (const source of INDICATOR_SOURCES) {
    onLog(`扫描：${source.name}`, 'info');
    const listUrls = source.listUrls || [source.listUrl];
    const titleFilter = source.titleRe || TITLE_HINTS;
    const anchors = [];
    let listFailed = false;

    for (const listUrl of listUrls) {
      let listHtml;
      try {
        const res = await httpGet(listUrl, { referer: source.siteUrl, retries: 1 });
        listHtml = res.text;
      } catch (err) {
        if (listUrls.length === 1) {
          onLog(`  列表抓取失败：${err.message}`, 'warn');
          listFailed = true;
        }
        continue;
      }

      anchors.push(
        ...parseAnchors(listHtml, listUrl)
          .filter((a) => source.articleRe.test(a.url))
          .filter((a) => titleFilter.test(a.title))
      );
      await sleep(300);
    }
    if (listFailed) continue;

    const picked = anchors
      .filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i)
      .slice(0, source.maxItems);

    onLog(`  命中指标类标题 ${picked.length} 条`, 'muted');

    for (const a of picked) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);

      let detail;
      try {
        const res = await httpGet(a.url, { referer: source.listUrl, retries: 1 });
        detail = parseDetail(res.text, a.url, a.title);
      } catch (err) {
        onLog(`  详情失败：${a.title.slice(0, 20)}`, 'warn');
        continue;
      }

      const bodyText = detail.text || '';
      const titlePeriod = guessPeriod(a.title) || guessPeriod(detail.title || '');

      /* 地方票房：句子同时出现地区名与「票房…亿元」才记录，来源标为地方官方 */
      for (const s of findSentences(bodyText, /票房/).slice(0, 6)) {
        for (const rule of REGION_RULES) {
          if (!rule.test.test(s)) continue;
          const num = pickNumber(s, 'box');
          if (!num || num.unit !== '亿元') continue;
          candidates.push({
            indicatorCode: rule.code,
            indicatorName: rule.name,
            period: titlePeriod || guessPeriod(s) || '',
            value: num.value,
            unit: num.unit,
            yoy: guessYoy(s),
            publishedAt: detail.publishedAt || a.publishedAt || '',
            sourceName: source.name,
            sourceUrl: a.url,
            articleTitle: detail.title || a.title,
            snippet: s.slice(0, 160),
            accept: ''
          });
        }
      }

      for (const matcher of MATCHERS) {
        if (!matcher.test.test(a.title) && !matcher.test.test(bodyText.slice(0, 800))) continue;

        const sentences = findSentences(bodyText, matcher.test).slice(0, 4);
        for (const s of sentences) {
          const num = pickNumber(s, matcher.kind);
          if (!num) continue;

          /* 单位必须与指标匹配，否则说明抽到了别的数字 */
          if (matcher.kind === 'admissions' && num.unit !== '万人次') continue;
          if (matcher.kind === 'screens' && num.unit !== '块') continue;
          if (matcher.kind === 'box' && num.unit !== '亿元') continue;

          /* 文章只讲一个期间；句中出现别的期间，通常是同比对照句，跳过避免错配 */
          const sentPeriod = guessPeriod(s);
          if (titlePeriod && sentPeriod && titlePeriod !== sentPeriod) continue;

          candidates.push({
            indicatorCode: matcher.code,
            indicatorName: matcher.name,
            period: titlePeriod || sentPeriod || guessPeriod(bodyText.slice(0, 400)) || '',
            value: num.value,
            unit: num.unit,
            yoy: guessYoy(s),
            publishedAt: detail.publishedAt || a.publishedAt || '',
            sourceName: source.name,
            sourceUrl: a.url,
            articleTitle: detail.title || a.title,
            snippet: s.slice(0, 160),
            accept: ''
          });
        }
      }
      await sleep(400);
    }
  }

  /* 同一指标同一期间只保留一条，避免同期间出现两个不同数值 */
  const unique = [];
  const codePeriod = new Set();
  for (const c of candidates) {
    const k = c.indicatorCode + '|' + c.period;
    if (codePeriod.has(k)) continue;
    codePeriod.add(k);
    unique.push(c);
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'indicator-candidates.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), items: unique }, null, 2),
    'utf8'
  );

  const head = ['accept', 'indicatorCode', 'indicatorName', 'period', 'value', 'unit', 'yoy', 'publishedAt', 'sourceName', 'sourceUrl', 'articleTitle', 'snippet'];
  const lines = [head.join(',')].concat(
    unique.map((c) => [c.accept, c.indicatorCode, c.indicatorName, c.period, c.value, c.unit, c.yoy, c.publishedAt, c.sourceName, c.sourceUrl, c.articleTitle, c.snippet].map(csvEscape).join(','))
  );
  fs.writeFileSync(path.join(DATA_DIR, 'indicator-candidates.csv'), '\ufeff' + lines.join('\r\n'), 'utf8');

  onLog(`采集完成：${unique.length} 条候选，已写入 data/indicator-candidates.csv`, 'ok');
  return unique;
}

if (require.main === module) {
  collect((msg, level) => console.log(msg)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { collect, INDICATOR_SOURCES };
