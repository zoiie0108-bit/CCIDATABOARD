'use strict';

/* ============================================================
   把确认过的候选合并进指标库
   用法：
     1) 运行 node server/collect-indicators.js 生成 data/indicator-candidates.csv
     2) 在 Excel 里把要采纳行的 accept 列改成 Y，保存（保持 UTF-8 CSV）
     3) 运行 node server/promote.js
   规则：
     - 只处理 accept = Y 的行
     - 同指标同期间已存在则覆盖数值，否则追加
     - 最新一期会同步写入 value / period / publishedAt
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV = path.join(DATA_DIR, 'indicator-candidates.csv');
const INDICATORS = path.join(DATA_DIR, 'indicators.json');

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

function periodKey(p) {
  return String(p || '').replace(/\s+/g, '');
}

function main() {
  if (!fs.existsSync(CSV)) {
    console.error('未找到 data/indicator-candidates.csv，请先运行 node server/collect-indicators.js');
    process.exit(1);
  }
  if (!fs.existsSync(INDICATORS)) {
    console.error('未找到 data/indicators.json');
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^\ufeff/, ''));
  const head = rows.shift().map((h) => h.trim());
  const idx = (name) => head.indexOf(name);

  const accepted = rows
    .filter((r) => String(r[idx('accept')] || '').trim().toUpperCase() === 'Y')
    .map((r) => ({
      code: r[idx('indicatorCode')],
      period: r[idx('period')],
      value: Number(r[idx('value')]),
      unit: r[idx('unit')],
      yoy: r[idx('yoy')] === '' ? null : Number(r[idx('yoy')]),
      publishedAt: r[idx('publishedAt')] || null,
      sourceName: r[idx('sourceName')],
      sourceUrl: r[idx('sourceUrl')]
    }))
    .filter((r) => r.code && isFinite(r.value));

  if (!accepted.length) {
    console.log('没有 accept=Y 的行，未做修改。');
    return;
  }

  const doc = JSON.parse(fs.readFileSync(INDICATORS, 'utf8'));
  let updated = 0;
  let added = 0;

  for (const row of accepted) {
    const ind = (doc.items || []).find((i) => i.code === row.code || i.id === row.code);
    if (!ind) {
      console.warn(`跳过：指标 ${row.code} 不在指标库中`);
      continue;
    }

    ind.history = Array.isArray(ind.history) ? ind.history : [];
    const key = periodKey(row.period);
    const existing = ind.history.find((h) => periodKey(h.period) === key);

    if (existing) {
      existing.value = row.value;
      /* 人工核对时补的同比不能被空值覆盖 */
      if (row.yoy != null) existing.yoy = row.yoy;
      existing.publishedAt = row.publishedAt;
      updated++;
    } else {
      ind.history.push({ period: row.period || '未标注期间', value: row.value, yoy: row.yoy, publishedAt: row.publishedAt });
      added++;
    }

    /* 最新一期（按发布日排序）同步到主字段，其余期间只进历史序列 */
    const latest = ind.history
      .slice()
      .sort((a, b) => String(b.publishedAt || b.period).localeCompare(String(a.publishedAt || a.period)))[0];

    if (latest) {
      ind.value = latest.value;
      ind.period = latest.period;
      ind.publishedAt = latest.publishedAt || ind.publishedAt || null;
      /* 同比必须跟着最新一期走，不能沿用后面某行的值 */
      ind.yoy = latest.yoy == null ? null : latest.yoy;
    }
    if (row.sourceName) ind.sourceName = row.sourceName;
    if (row.sourceUrl && latest && periodKey(row.period) === periodKey(latest.period)) ind.sourceUrl = row.sourceUrl;
    if (ind.dataStatus === 'missing') ind.dataStatus = 'reported';
  }

  fs.writeFileSync(INDICATORS, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`已合并：新增 ${added} 期，更新 ${updated} 期`);
  console.log('下一步：node server/build.js --no-sync');
}

main();
