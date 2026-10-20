'use strict';

/* ============================================================
   基础抓取与解析工具
   - 无第三方依赖
   - 超时 / 重试 / 编码识别 / HTML 清洗
   ============================================================ */

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 CulturePolicyObserver/1.0';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectCharset(buf, hint) {
  if (hint) return /gb2312|gbk|gb18030/i.test(hint) ? 'gb18030' : 'utf-8';
  const head = buf.slice(0, 4096).toString('latin1');
  const m = head.match(/charset\s*=\s*["']?([\w-]+)/i);
  const cs = m ? m[1].toLowerCase() : 'utf-8';
  if (cs === 'gb2312' || cs === 'gbk' || cs === 'gb18030') return 'gb18030';
  if (cs === 'utf8') return 'utf-8';
  return cs;
}

async function httpGet(url, options = {}) {
  const { timeout = 15000, retries = 2, referer = '', headers = {} } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': DEFAULT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
          ...(referer ? { Referer: referer } : {}),
          ...headers
        }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      const charset = detectCharset(buf, res.headers.get('content-type'));
      let text;
      try {
        text = new TextDecoder(charset).decode(buf);
      } catch {
        text = buf.toString('utf8');
      }
      return { url: res.url || url, status: res.status, text };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) await sleep(700 * (attempt + 1));
    }
  }
  throw lastError;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…', middot: '·', times: '×'
};

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] !== undefined ? ENTITIES[n.toLowerCase()] : m));
}

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\u00a0/g, ' ');
}

function tidy(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t\u3000]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function absolutize(href, base) {
  if (!href) return '';
  const h = href.trim();
  if (/^javascript:/i.test(h) || h === '#' || h.startsWith('#')) return '';
  try {
    return new URL(h, base).toString();
  } catch {
    return '';
  }
}

/** 解析列表页链接：title / url / context（锚点后 240 字符，用于找日期） */
function parseAnchors(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absolutize(m[1], baseUrl);
    if (!url) continue;
    const title = tidy(stripTags(m[2])).replace(/\s+/g, ' ').trim();
    if (title.length < 6) continue;
    const context = stripTags(html.slice(re.lastIndex, re.lastIndex + 240)).replace(/\s+/g, ' ');
    out.push({ title: cleanTitle(title), url, context });
  }
  return out;
}

function cleanTitle(title) {
  let t = String(title || '');
  /* 嵌套 <a> 或残缺标签可能留下 `">标题` 片段，取最后一段有效文本 */
  if (t.includes('">')) t = t.slice(t.lastIndexOf('">') + 2);
  return t
    .replace(/\[(图解|视频|图片|音频|H5|PDF)\]/g, '')
    .replace(/--+>/g, '')
    .replace(/^[\s·•\-—◆]+/, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const DATE_PATTERNS = [
  /(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/,
  /t(20\d{2})(\d{2})(\d{2})_/,
  /\/(20\d{2})(\d{2})\/content_/,
  /\/(20\d{2})(\d{2})(\d{2})\//,
  /(20\d{2})(\d{2})(\d{2})(?!\d)/
];

const GENERIC_TITLES = /^(政务公开数据|首页|信息公开|政策文件|政策法规|网站首页|.*人民政府门户网站)$/;

function toISODate(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** 从 URL / 标题 / 上下文推断发布日期 */
function guessDate({ url = '', title = '', context = '' }) {
  const haystacks = [url, title, context];
  for (const text of haystacks) {
    for (const re of DATE_PATTERNS) {
      const m = text.match(re);
      if (!m || !m[1] || !m[2] || !m[3]) continue;
      const iso = toISODate(m[1], m[2], m[3]);
      if (iso && iso >= '2000-01-01') return iso;
    }
  }
  return null;
}

function metaContent(html, names) {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
      'i'
    );
    const m = html.match(re);
    if (m && m[1].trim()) return decodeEntities(m[1].trim());
    const re2 = new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${name}["']`,
      'i'
    );
    const m2 = html.match(re2);
    if (m2 && m2[1].trim()) return decodeEntities(m2[1].trim());
  }
  return '';
}

const DOC_NUMBER_RE = /[\u4e00-\u9fa5]{1,16}(?:〔|\[|【)\s*20\d{2}\s*(?:〕|\]|】)\s*\d+\s*号/;
const AGENCY_HINT_RE = /(局|委员会|办公厅|办公室|人民政府|厅|部|中心|管理处)$/;

function parseDetail(html, url, fallbackTitle) {
  const text = tidy(stripTags(html));

  let title =
    metaContent(html, ['ArticleTitle', 'article:title', 'og:title']) ||
    (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ? tidy(stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)[1])) : '');
  if (!title && html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)) {
    title = tidy(stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)[1]));
  }
  title = cleanTitle(String(title).replace(/[_\-—|].*$/, '').trim());

  /* 详情页标题不可靠时回退到列表标题 */
  if (fallbackTitle) {
    const normalize = (s) => String(s || '').replace(/[\s《》「」()（）]/g, '');
    const overlap = title && normalize(title).slice(0, 8) === normalize(fallbackTitle).slice(0, 8);
    if (!title || title.length < 8 || GENERIC_TITLES.test(title) || !overlap) {
      title = fallbackTitle;
    }
  }

  const titleAt = text.indexOf(title.replace(/\s/g, ''));
  const headWindow = text.slice(Math.max(0, titleAt), Math.max(0, titleAt) + 1400);
  const docNumber = (headWindow.match(DOC_NUMBER_RE) || [null])[0];

  let agency = metaContent(html, ['author', 'ArticleAuthor', 'source', 'og:site_name']) || '';
  const ORG_RE = /(局|委员会|办公厅|办公室|人民政府|厅|部|中心|管理处|署|院|馆|协会|集团)$/;
  if (!agency || agency.length > 30 || !ORG_RE.test(agency)) {
    const lines = text.split('\n').slice(0, 80);
    const found = lines.find((l) => l.length >= 4 && l.length <= 30 && ORG_RE.test(l) && !/^\d/.test(l));
    agency = found || '';
  }

  const pubRaw =
    metaContent(html, ['PubDate', 'pubdate', 'publishdate', 'article:published_time', 'og:release_date']) || '';
  let publishedAt = guessDate({ url, title, context: pubRaw });
  if (!publishedAt) publishedAt = guessDate({ url, title, context: text.slice(0, 1200) });

  const marker = text.indexOf(title.replace(/\s/g, ''));
  const bodyStart = marker > 0 ? marker : Math.min(text.length, 400);
  let body = text.slice(bodyStart, bodyStart + 6000);
  body = body.replace(/分享[:：]?[\s\S]{0,40}$/, '').trim();

  return { title, docNumber: docNumber || null, agency: agency || null, publishedAt, body, text };
}

const SENTENCE_SPLIT = /(?<=[。！？；])|\n/;

/** 抽取式摘要草稿：只摘原文句子，不做改写 */
function draftSummary(body, maxChars = 150) {
  const sentences = String(body || '')
    .split(SENTENCE_SPLIT)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 18 && s.length <= 180);

  const strong = /支持|鼓励|给予|设立|安排|推动|加强|重点支持|到20\d{2}年|最高不超过|专项资金|补贴|奖励/;
  const weak = /提出|明确|目标|任务|措施|实施/;
  const noise = /联系|咨询|电话|传真|邮箱|地址|请各|附件|下载|打印|字号|责任编辑|来源[:：]|编辑[:：]|分享|扫一扫|阅读原文/;

  const picked = [];
  let total = 0;
  for (const s of sentences) {
    if (noise.test(s)) continue;
    if (!strong.test(s) && !weak.test(s)) continue;
    if (picked.includes(s)) continue;
    if (total + s.length > maxChars && picked.length) break;
    picked.push(s);
    total += s.length;
    if (picked.length >= 2) break;
  }
  return picked.join('');
}

module.exports = {
  sleep,
  httpGet,
  stripTags,
  tidy,
  decodeEntities,
  parseAnchors,
  cleanTitle,
  guessDate,
  parseDetail,
  draftSummary,
  metaContent
};
