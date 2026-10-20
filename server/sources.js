'use strict';

/* ============================================================
   官方来源目录
   - listUrls 支持多页（同一栏目翻页）
   - articleRe 用于识别详情页
   - maxItems 控制单次抓取的详情页数量
   新增来源只需在此登记
   ============================================================ */

function pages(base, count, pattern) {
  return Array.from({ length: count }, (_, i) => base + pattern.replace('{n}', String(i)));
}

const SOURCES = [
  {
    id: 'cn-gov',
    name: '中国政府网 · 政策',
    organization: '国务院',
    regionCode: 'national',
    listUrls: ['https://www.gov.cn/zhengce/'],
    siteUrl: 'https://www.gov.cn/',
    articleRe: /\/content_\d+\.htm/i,
    maxItems: 12,
    enabled: true,
    note: '中央层面政策发布栏目'
  },
  {
    id: 'cn-mct',
    name: '文化和旅游部 · 政策法规',
    organization: '文化和旅游部',
    regionCode: 'national',
    listUrls: ['https://zwgk.mct.gov.cn/zfxxgkml/zcfg/'],
    siteUrl: 'https://www.mct.gov.cn/',
    articleRe: /t\d{8}_\d+\.html/i,
    maxItems: 20,
    enabled: true,
    note: '部委政策法规与规章'
  },
  {
    id: 'zj-gov',
    name: '浙江省人民政府 · 法规文件',
    organization: '浙江省人民政府',
    regionCode: 'zhejiang',
    listUrls: ['https://www.zj.gov.cn/col/col1544911/index.html'],
    siteUrl: 'https://www.zj.gov.cn/',
    articleRe: /\/art\/\d{4}\/art_[0-9a-f]+\.html/i,
    maxItems: 20,
    enabled: true,
    note: '省政府规章与行政规范性文件'
  },
  {
    id: 'bj-gov',
    name: '首都之窗 · 政策文件',
    organization: '北京市人民政府',
    regionCode: 'beijing',
    listUrls: [
      'https://www.beijing.gov.cn/zhengce/zhengcefagui/index.html',
      ...pages('https://www.beijing.gov.cn/zhengce/zhengcefagui/index_', 9, '{n}.html')
    ],
    siteUrl: 'https://www.beijing.gov.cn/',
    articleRe: /t\d{8}_\d+\.html/i,
    maxItems: 60,
    enabled: true,
    note: '市政府及部门政策文件，含历史分页'
  },
  {
    id: 'zj-ct',
    name: '浙江省文化广电和旅游厅 · 通知公告',
    organization: '浙江省文化广电和旅游厅',
    regionCode: 'zhejiang',
    listUrls: ['https://ct.zj.gov.cn/'],
    siteUrl: 'https://ct.zj.gov.cn/',
    articleRe: /\/col\/col\d+\/art\/\d{4}\//i,
    titleFilter: /办法|规定|通知|意见|方案|规划|细则|政策|扶持|资金|奖励|措施|条例|决定|公告|公示|公布|指南|标准|遴选|申报|管理|实施|修订|废止/,
    maxItems: 10,
    enabled: true,
    note: '厅门户首页公告区；栏目列表页为 JS 渲染，暂以首页文章为准'
  },
  {
    id: 'sh-gov',
    name: '上海市文化和旅游局 · 政策法规',
    organization: '上海市文化和旅游局',
    regionCode: 'shanghai',
    listUrls: ['https://whlyj.sh.gov.cn/zcfg/'],
    siteUrl: 'https://whlyj.sh.gov.cn/',
    articleRe: /\/(?:zcfg|gfxwj|jqxxgk|zw-hgdf\d+)\/\d{8}\/[0-9a-f]+\.html/i,
    maxItems: 24,
    enabled: true,
    note: '市文旅局政策法规、规范性文件与公开信息'
  },
  {
    id: 'hz-gov',
    name: '杭州市文化广电旅游局 · 政策与公告',
    organization: '杭州市文化广电旅游局',
    regionCode: 'hangzhou',
    listUrls: ['http://wgly.hangzhou.gov.cn/'],
    siteUrl: 'http://wgly.hangzhou.gov.cn/',
    articleRe: /\/art\/\d{4}\//i,
    titleFilter: /办法|规定|通知|意见|方案|规划|细则|政策|扶持|资金|奖励|措施|条例|决定|公告|公示|指南|标准/,
    maxItems: 12,
    enabled: true,
    note: '市文化广电旅游局门户；市政府门户政策栏目为 JS 渲染，暂以本栏目替代'
  }
];

function getSource(id) {
  return SOURCES.find((s) => s.id === id) || null;
}

module.exports = { SOURCES, getSource };
