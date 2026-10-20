'use strict';

/* ============================================================
   分类与重点政策判定
   - 关键词规则，可解释、可人工复核
   - 不输出结论性判断，只产出标签草稿
   ============================================================ */

const TOPIC_RULES = [
  ['film_tv', /电影|电视剧|网络视听|影视|银幕|票房|视听|微短剧|节目制作|广播|动画片/],
  ['cultural_space', /园区|街区|空间|场馆|剧院|剧场|图书馆|博物馆|文化馆|美术馆|基地|设施/],
  ['cultural_digitalization', /数字化|数字文化|人工智能|大数据|沉浸式|虚拟|云平台|文化科技|信息技术/],
  ['cultural_consumption', /文化消费|演出|展览|文旅|旅游|夜经济|消费场景|市场培育/],
  ['industry_factors', /人才|资金|融资|版权|土地|税收|补贴|专项|要素/],
  ['industry_governance', /管理办法|规范|监管|标准|审批|准入|执法|治理/],
  ['public_culture', /公共文化|公共服务|文化惠民|免费开放/],
  ['heritage', /非遗|文化遗产|文物|考古|传统工艺/]
];

const TOOL_RULES = [
  ['fiscal_support', /专项资金|补贴|奖励|资助|贴息|政府购买/],
  ['tax_finance', /税收|税费|融资|贷款|金融|担保|基金/],
  ['space_facility', /园区|场地|设施|空间|改造|建设用地/],
  ['talent_innovation', /人才|创新|研发|技术|实验室|平台/],
  ['market_development', /消费|市场|推广|合作|出口|国际|展演/],
  ['regulation_standard', /管理|规范|监管|标准|准入|审批/],
  ['public_service', /公共服务|公共文化|惠民/],
  ['project_selection', /申报|征集|评选|认定|示范|遴选/]
];

const TYPE_RULES = [
  ['consultation', /征求意见|公开征求/],
  ['policy_interpretation', /政策解读|解读|一图读懂|问答/],
  ['funding_announcement', /公示|拟支持|资金安排|拨付/],
  ['application_notice', /申报|征集|申报指南/],
  ['implementation_rule', /实施细则|管理办法|办法|规定/],
  ['action_plan', /行动方案|实施方案|行动计划|工作方案/],
  ['plan_guideline', /规划|纲要|指导意见|若干意见|实施意见|意见/],
  ['support_policy', /扶持|支持|若干措施|政策措施|奖励办法/]
];

const KEY_TITLE_RE = /规划|行动方案|实施方案|行动计划|指导意见|实施意见|若干措施|支持政策|管理办法|实施细则/;
/* 申报、公示、批复类不作为重点政策 */
const KEY_EXCLUDE_RE = /申报指南|申报通知|征求意见|公示|批复|评估结果|遴选|职称|采购|公告/;

const CULTURE_RE = /文化|影视|电影|电视剧|视听|广电|广播电视|演艺|演出|动漫|动画|出版|版权|文创|创意|艺术|非遗|文物|遗产|旅游|文旅|博物馆|图书馆|美术馆|剧院|剧场|文化产业|文艺|网络视听|微短剧|纪录片|音乐|文学/;

/* 新闻 / 活动 / 会议类标题排除：不属于政策文件 */
const EXCLUDE_RE = /新闻发布会|发布会|通气会|答记者问|记者问|访谈|侧记|综述|评论员|图片新闻|视频新闻|开幕|闭幕|举行|举办|召开|启动仪式|调研|座谈|会见|签约|招聘|招标|中标|采购公告|成交公告|人事任免|任免|讣告|声明|致歉|征集意见采纳|行政复议|应诉|职称|评审|保证金/;

function uniq(arr) {
  return Array.from(new Set(arr));
}

function pickTags(text, rules) {
  const hits = [];
  for (const [key, re] of rules) {
    if (re.test(text)) hits.push(key);
  }
  return hits;
}

function detectDocumentType(title, body) {
  /* 文件类型优先按标题判断，正文只作为兜底，避免正文里的引用文字干扰 */
  for (const [type, re] of TYPE_RULES) {
    if (re.test(title)) return type;
  }
  const scope = String(body || '').slice(0, 300);
  for (const [type, re] of TYPE_RULES) {
    if (re.test(scope)) return type;
  }
  return 'other';
}

function isCultural(title, body) {
  const scope = title + ' ' + String(body || '').slice(0, 600);
  if (CULTURE_RE.test(scope)) return true;
  /* 园区 / 街区 / 基地等空间词，仅在文化语境下计入 */
  return /(文化|创意|艺术|影视|演艺)[^，。]{0,12}(园区|街区|基地|空间)/.test(scope);
}

function isExcluded(title) {
  return EXCLUDE_RE.test(title);
}

/**
 * 重点政策判定，返回命中规则编号，便于页面解释
 * R1 国家级 + 规划/方案/扶持/细则
 * R2 标题命中规划、方案、意见、办法、措施
 * R3 标题命中专项资金/扶持/奖励
 */
function keyPolicy(title, documentType, regionCode) {
  if (KEY_EXCLUDE_RE.test(title)) {
    return { isKeyPolicy: false, keyPolicyRule: null };
  }
  if (regionCode === 'national' &&
      ['plan_guideline', 'action_plan', 'support_policy', 'implementation_rule'].includes(documentType)) {
    return { isKeyPolicy: true, keyPolicyRule: 'R1 国家级重点文件类型' };
  }
  if (KEY_TITLE_RE.test(title)) {
    return { isKeyPolicy: true, keyPolicyRule: 'R2 标题命中重点文件关键词' };
  }
  if (/专项资金|扶持|奖励|补贴/.test(title)) {
    return { isKeyPolicy: true, keyPolicyRule: 'R3 标题命中资金支持关键词' };
  }
  return { isKeyPolicy: false, keyPolicyRule: null };
}

function classify({ title, body, regionCode }) {
  const scope = title + ' ' + String(body || '').slice(0, 2000);
  const documentType = detectDocumentType(title, body);
  const key = keyPolicy(title, documentType, regionCode);
  return {
    documentType,
    topicTags: pickTags(scope, TOPIC_RULES),
    toolTags: pickTags(scope, TOOL_RULES),
    isKeyPolicy: key.isKeyPolicy,
    keyPolicyRule: key.keyPolicyRule
  };
}

module.exports = {
  TOPIC_RULES,
  TOOL_RULES,
  TYPE_RULES,
  classify,
  isCultural,
  isExcluded,
  detectDocumentType,
  keyPolicy,
  uniq
};
