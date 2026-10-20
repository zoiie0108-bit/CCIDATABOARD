'use strict';

/* ============================================================
   地方票房人工补录
   用途：分地区票房没有稳定的官方数据栏目，自动抓取经常取不到，
        因此保留一条人工补录通道，要求填写来源链接以便回溯。
   用法：
     1) 在 data/region-manual.csv 追加行（保留表头，一行一个地区一个期间）
     2) 运行 node server/import-regional.js
     3) 运行 node server/build.js --no-sync
   必填：indicatorCode / period / value / sourceUrl
   允许的 indicatorCode：ZJ_BOX_OFFICE / HZ_BOX_OFFICE / BJ_BOX_OFFICE / SH_BOX_OFFICE
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV = path.join(DATA_DIR, 'region-manual.csv');
const INDICATORS = path.join(DATA_DIR, 'indicators.json');

const ALLOWED = new Set(['ZJ_BOX_OFFICE', 'HZ_BOX_OFFICE', 'BJ_BOX_OFFICE', 'SH_BOX_OFFICE']);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function main() {
  if (!fs.existsSync(CSV)) {
    console.error('未找到 data/region-manual.csv');
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^\ufeff/, '')).filter((r) => r.some((v) => String(v).trim()));
  if (!rows.length) {
    console.log('region-manual.csv 为空，未做修改。');
    return;
  }

  const head = rows.shift().map((h) => h.trim());
  const idx = (name) => head.indexOf(name);

  const doc = JSON.parse(fs.readFileSync(INDICATORS, 'utf8'));
  let applied = 0;
  let skipped = 0;

  for (const r of rows) {
    const code = String(r[idx('indicatorCode')] || '').trim();
    const period = String(r[idx('period')] || '').trim();
    const value = Number(r[idx('value')]);
    const sourceUrl = String(r[idx('sourceUrl')] || '').trim();

    if (!ALLOWED.has(code) || !period || !isFinite(value) || !sourceUrl) {
      console.warn(`跳过一行（代码/期间/数值/来源链接不完整）：${code} ${period} ${value || ''}`);
      skipped++;
      continue;
    }

    const ind = doc.items.find((i) => i.code === code);
    if (!ind) { skipped++; continue; }

    ind.history = Array.isArray(ind.history) ? ind.history : [];
    const entry = {
      period,
      value,
      yoy: r[idx('yoy')] === '' ? null : Number(r[idx('yoy')]),
      publishedAt: r[idx('publishedAt')] || null
    };
    const existing = ind.history.find((h) => String(h.period).replace(/\s+/g, '') === period.replace(/\s+/g, ''));
    if (existing) Object.assign(existing, entry);
    else ind.history.push(entry);

    const latest = ind.history
      .slice()
      .sort((a, b) => String(b.publishedAt || b.period).localeCompare(String(a.publishedAt || a.period)))[0];
    ind.value = latest.value;
    ind.period = latest.period;
    ind.yoy = latest.yoy == null ? null : latest.yoy;
    ind.publishedAt = latest.publishedAt || ind.publishedAt || null;
    ind.sourceName = r[idx('sourceName')] || ind.sourceName;
    ind.sourceUrl = sourceUrl;
    ind.sourceLevel = '官方';
    ind.dataStatus = 'reported';
    applied++;
  }

  fs.writeFileSync(INDICATORS, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`人工补录：已写入 ${applied} 行，跳过 ${skipped} 行`);
  console.log('下一步：node server/build.js --no-sync');
}

main();
