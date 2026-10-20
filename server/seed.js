'use strict';

/* ============================================================
   首次启动时的种子数据
   - 政策：4 条已核验的北京市政策（原文链接可访问）
   - 指标：来自公开统计的已录入值，标记 reported（待复核口径）
   - 空间：4 条可核验的公共文化设施名录，运营字段留空
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const now = new Date().toISOString();

const POLICY_SEED = [
  {
    id: 'seed-bj-uhd',
    title: '北京市广播电视局关于印发《北京市关于支持超高清视听产业高质量发展的若干措施》的通知',
    normalizedTitle: '北京市广播电视局关于印发北京市关于支持超高清视听产业高质量发展的若干措施的通知',
    documentNumber: '京广发〔2026〕73号',
    regionCode: 'beijing',
    regionLevel: 'beijing',
    regionName: '北京市',
    issuingAgency: '北京市广播电视局',
    publishedAt: '2026-10-08',
    effectiveAt: null,
    expiresAt: null,
    documentType: 'support_policy',
    policyStatus: 'in_force',
    applicationStatus: 'not_applicable',
    summaryWhat: '设立北京市超高清视听产业发展支持资金，支持4K/8K制作、传输覆盖、后期制作、应用场景与核心技术攻关，单个项目最高500万元。',
    summaryWho: '在京开展超高清视听业务的企事业单位、科研院所、社会团体及民办非企业单位。',
    summaryIndustry: '超高清视听内容制作、传输覆盖、终端设备与数字视听服务。',
    summarySource: 'human',
    summaryReviewStatus: 'verified',
    topicTags: ['film_tv', 'cultural_digitalization'],
    toolTags: ['fiscal_support', 'talent_innovation'],
    targetGroups: ['视听企业', '科研院所'],
    officialUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202610/t20261008_4893134.html',
    linkStatus: 'ok',
    sourceId: 'bj-gov',
    sourceName: '首都之窗 · 政策文件',
    sourcePublishedUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/',
    applicationStartAt: null,
    applicationDeadline: null,
    deadlineVerified: false,
    isMajorPolicy: false,
    majorPolicyReason: null,
    homepagePinUntil: null,
    isKeyPolicy: true,
    keyPolicyRule: 'R2 标题命中重点文件关键词',
    verificationStatus: 'verified',
    visibilityStatus: 'published',
    sourceLastCheckedAt: now,
    collectedAt: now,
    lastUpdatedAt: now,
    isMock: false,
    keyClauses: [
      { quote: '设立北京市超高清视听产业发展支持资金，用于支持广播电视网络视听领域4K/8K超高清制作、传输覆盖、接收终端、后期制作、应用场景、核心技术攻关等方面。', location: '第一条', verified: true },
      { quote: '鼓励以4K/8K超高清技术拍摄，按照超高清制作能力、超高清内容质量等综合评定，单个项目支持金额不超过500万元。', location: '第二条', verified: true }
    ],
    relations: []
  },
  {
    id: 'seed-bj-ai',
    title: '北京市广播电视局关于印发《北京市促进“人工智能+视听”产业高质量发展重点项目支持管理办法（2026—2029年）》的通知',
    normalizedTitle: '北京市广播电视局关于印发北京市促进人工智能+视听产业高质量发展重点项目支持管理办法2026—2029年的通知',
    documentNumber: '京广发〔2026〕71号',
    regionCode: 'beijing',
    regionLevel: 'beijing',
    regionName: '北京市',
    issuingAgency: '北京市广播电视局',
    publishedAt: '2026-09-24',
    effectiveAt: null,
    expiresAt: null,
    documentType: 'implementation_rule',
    policyStatus: 'in_force',
    applicationStatus: 'not_applicable',
    summaryWhat: '对“人工智能+视听”的技术、内容、场景三类重点项目给予事后支持，单个项目最高300万元。',
    summaryWho: '广电视听领域内依法设立的产业活动单位和法人单位。',
    summaryIndustry: '视听大模型、智能内容生产、虚拟制作与网络视听节目。',
    summarySource: 'human',
    summaryReviewStatus: 'verified',
    topicTags: ['film_tv', 'cultural_digitalization'],
    toolTags: ['fiscal_support', 'talent_innovation'],
    targetGroups: ['视听企业', '广电机构'],
    officialUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202609/t20260924_4879514.html',
    linkStatus: 'ok',
    sourceId: 'bj-gov',
    sourceName: '首都之窗 · 政策文件',
    sourcePublishedUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/',
    applicationStartAt: null,
    applicationDeadline: null,
    deadlineVerified: false,
    isMajorPolicy: false,
    majorPolicyReason: null,
    homepagePinUntil: null,
    isKeyPolicy: true,
    keyPolicyRule: 'R2 标题命中重点文件关键词',
    verificationStatus: 'verified',
    visibilityStatus: 'published',
    sourceLastCheckedAt: now,
    collectedAt: now,
    lastUpdatedAt: now,
    isMock: false,
    keyClauses: [
      { quote: '依照技术先进性和应用效果等进行评审，单个项目支持金额最高不超过300万元。', location: '第四条', verified: true }
    ],
    relations: []
  },
  {
    id: 'seed-bj-newmass',
    title: '北京市广播电视局关于印发《新时代北京市网络视听领域繁荣发展新大众文艺实施方案（2026-2030年）》的通知',
    normalizedTitle: '北京市广播电视局关于印发新时代北京市网络视听领域繁荣发展新大众文艺实施方案2026-2030年的通知',
    documentNumber: '京广发〔2026〕64号',
    regionCode: 'beijing',
    regionLevel: 'beijing',
    regionName: '北京市',
    issuingAgency: '北京市广播电视局',
    publishedAt: '2026-09-21',
    effectiveAt: null,
    expiresAt: null,
    documentType: 'action_plan',
    policyStatus: 'in_force',
    applicationStatus: 'not_applicable',
    summaryWhat: '部署网络视听领域新大众文艺繁荣发展任务，覆盖内容创作、平台建设和人才培育。',
    summaryWho: '各区委宣传部、经开区工委宣传文化部及市广电局相关单位。',
    summaryIndustry: '网络视听内容创作、平台运营与网络微短剧等新业态。',
    summarySource: 'human',
    summaryReviewStatus: 'verified',
    topicTags: ['film_tv', 'cultural_consumption'],
    toolTags: ['market_development', 'talent_innovation'],
    targetGroups: ['网络视听平台', '内容制作机构'],
    officialUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202609/t20260921_4874115.html',
    linkStatus: 'ok',
    sourceId: 'bj-gov',
    sourceName: '首都之窗 · 政策文件',
    sourcePublishedUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/',
    applicationStartAt: null,
    applicationDeadline: null,
    deadlineVerified: false,
    isMajorPolicy: false,
    majorPolicyReason: null,
    homepagePinUntil: null,
    isKeyPolicy: true,
    keyPolicyRule: 'R2 标题命中重点文件关键词',
    verificationStatus: 'verified',
    visibilityStatus: 'published',
    sourceLastCheckedAt: now,
    collectedAt: now,
    lastUpdatedAt: now,
    isMock: false,
    keyClauses: [],
    relations: []
  },
  {
    id: 'seed-bj-bookstore',
    title: '中共北京市委经济技术开发区工委宣传文化部关于开展2026年实体书店发展奖励申报的通知',
    normalizedTitle: '中共北京市委经济技术开发区工委宣传文化部关于开展2026年实体书店发展奖励申报的通知',
    documentNumber: null,
    regionCode: 'beijing',
    regionLevel: 'beijing',
    regionName: '北京市',
    issuingAgency: '中共北京市委经济技术开发区工委宣传文化部',
    publishedAt: '2026-06-23',
    effectiveAt: null,
    expiresAt: null,
    documentType: 'application_notice',
    policyStatus: 'in_force',
    applicationStatus: 'closed',
    summaryWhat: '开展2026年实体书店发展奖励申报，覆盖“一刻钟”建设、公共文化服务、特色发展和活动组织四类奖励。',
    summaryWho: '北京经济技术开发区内符合条件的实体书店运营企业。',
    summaryIndustry: '实体书店运营与公共文化服务。',
    summarySource: 'human',
    summaryReviewStatus: 'verified',
    topicTags: ['cultural_consumption', 'public_culture'],
    toolTags: ['fiscal_support', 'project_selection'],
    targetGroups: ['实体书店'],
    officialUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260623_4712230.html',
    linkStatus: 'ok',
    sourceId: 'bj-gov',
    sourceName: '首都之窗 · 政策文件',
    sourcePublishedUrl: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/',
    applicationStartAt: '2026-06-24',
    applicationDeadline: '2026-08-04',
    deadlineVerified: true,
    isMajorPolicy: false,
    majorPolicyReason: null,
    homepagePinUntil: null,
    isKeyPolicy: false,
    keyPolicyRule: null,
    verificationStatus: 'verified',
    visibilityStatus: 'published',
    sourceLastCheckedAt: now,
    collectedAt: now,
    lastUpdatedAt: now,
    isMock: false,
    keyClauses: [],
    relations: []
  }
];

const INDICATOR_SEED = require('./indicators-template.json');

function writeIfMissing(file, value) {
  const target = path.join(DATA_DIR, file);
  if (fs.existsSync(target)) return false;
  fs.writeFileSync(target, JSON.stringify(value, null, 2), 'utf8');
  return true;
}

function ensureSeed() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  writeIfMissing('policies.json', { version: 1, updatedAt: now, items: POLICY_SEED });
  writeIfMissing('indicators.json', { version: 2, updatedAt: now, items: INDICATOR_SEED });
  writeIfMissing('sync-runs.json', { version: 1, items: [] });
  writeIfMissing('sources-state.json', { items: [] });
}

module.exports = { ensureSeed, POLICY_SEED, INDICATOR_SEED };
