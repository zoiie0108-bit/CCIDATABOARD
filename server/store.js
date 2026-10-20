'use strict';

/* ============================================================
   JSON 持久化与去重合并
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  policies: 'policies.json',
  indicators: 'indicators.json',
  runs: 'sync-runs.json',
  sourcesState: 'sources-state.json'
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(name, fallback) {
  ensureDir();
  const file = path.join(DATA_DIR, FILES[name] || name);
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[store] 读取失败', file, err.message);
    return fallback;
  }
}

function writeJson(name, value) {
  ensureDir();
  const file = path.join(DATA_DIR, FILES[name] || name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function loadPolicies() {
  const data = readJson('policies', { items: [] });
  return Array.isArray(data.items) ? data : { items: [] };
}

function savePolicies(doc) {
  doc.updatedAt = new Date().toISOString();
  writeJson('policies', doc);
}

function loadRuns() {
  return readJson('runs', { items: [] });
}

function saveRuns(doc) {
  doc.items = (doc.items || []).slice(0, 60);
  writeJson('runs', doc);
}

function loadIndicators() {
  return readJson('indicators', { items: [] });
}

/* ---------------- 归一化与去重 ---------------- */

function normalizeUrl(url) {
  if (!url) return '';
  return String(url)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/+$/, '');
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[《》「」『』（）()【】\[\]，,。.、；;：:！!？?“”"'‘’—\-_/]/g, '');
}

function hashText(text) {
  return crypto.createHash('sha1').update(String(text || ''), 'utf8').digest('hex').slice(0, 16);
}

function policyKeys(p) {
  const keys = [];
  const u = normalizeUrl(p.officialUrl);
  if (u) keys.push('url:' + u);
  if (p.documentNumber && p.issuingAgency) {
    keys.push('doc:' + p.documentNumber.trim() + '|' + String(p.issuingAgency).trim());
  }
  if (p.title && p.publishedAt) {
    keys.push('title:' + normalizeTitle(p.title) + '|' + p.publishedAt);
  }
  return keys;
}

function buildIndex(items) {
  const map = new Map();
  for (const p of items) {
    for (const k of policyKeys(p)) {
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
  }
  return map;
}

/** 返回命中的已有记录（任一键命中） */
function findExisting(index, candidate) {
  for (const k of policyKeys(candidate)) {
    const hit = index.get(k);
    if (hit && hit.length) return hit[0];
  }
  return null;
}

function registerInIndex(index, policy) {
  for (const k of policyKeys(policy)) {
    if (!index.has(k)) index.set(k, []);
    const arr = index.get(k);
    if (!arr.includes(policy)) arr.push(policy);
  }
}

/** 合并：已有记录只更新巡检字段，不用旧数据覆盖人工核验结果 */
function mergePolicy(existing, incoming) {
  const changed = existing.contentHash && incoming.contentHash && existing.contentHash !== incoming.contentHash;
  existing.lastCheckedAt = new Date().toISOString();
  if (changed) {
    existing.contentUpdatedAt = new Date().toISOString();
    existing.contentHash = incoming.contentHash;
  }
  if (!existing.summaryWhat && incoming.summaryWhat) {
    existing.summaryWhat = incoming.summaryWhat;
    existing.summaryReviewStatus = 'pending';
    existing.summarySource = 'extractive_draft';
  }
  if (!existing.documentNumber && incoming.documentNumber) existing.documentNumber = incoming.documentNumber;
  if (!existing.issuingAgency && incoming.issuingAgency) existing.issuingAgency = incoming.issuingAgency;
  if (!existing.publishedAt && incoming.publishedAt) existing.publishedAt = incoming.publishedAt;
  existing.verificationStatus = existing.verificationStatus === 'verified' ? 'verified' : 'pending';
  return existing;
}

module.exports = {
  DATA_DIR,
  readJson,
  writeJson,
  loadPolicies,
  savePolicies,
  loadRuns,
  saveRuns,
  loadIndicators,
  normalizeUrl,
  normalizeTitle,
  hashText,
  policyKeys,
  buildIndex,
  findExisting,
  registerInIndex,
  mergePolicy
};
