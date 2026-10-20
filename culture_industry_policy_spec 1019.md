# 文化产业观察站｜政策追踪模块方案与数据规则表

> 版本：V0.1\
> 配套文档：[文化产业观察站_一期总方案.md](./文化产业观察站_一期总方案.md) —— 第一期产品的模块关系、统一数据结构、指标字典、更新机制与页面交互以该文件为准；本文件专注 **模块 A 政策追踪** 的字段、枚举、排序、去重与验收规则。\
> 范围调整（2026-10）：区域在国家级、北京市、上海市、杭州市之外**增加浙江省**；一期**移除申报倒计时与置顶提醒**，只做重点政策摘要同步。\
> 用途：作为 VS Code
> 开发依据，指导第一期政策追踪模块的数据建模、采集、分类、排序、前端展示和异常处理。\
> 范围：国家级、浙江省、北京市、上海市、杭州市；政策清单 + 政策详情基础能力。\
> 原则：先保证来源可信、字段清晰、规则可解释，再逐步增加自动化能力。

------------------------------------------------------------------------

## 1. 产品目标与第一期边界

### 1.1 产品目标

建立一个可持续更新、可检索、可追溯的文化产业政策库。首页以近期政策动态为入口，帮助研究者快速了解：

1.  最近发布或更新了什么政策；
2.  政策主要做了什么、支持谁、涉及什么产业方向；
3.  政策来自哪个地区和机构；
4.  是否存在申报期限、实施期限或政策状态变化；
5.  如何回到官方原文核对信息。

### 1.2 第一阶段覆盖范围

-   地区：国家级、浙江省、北京、上海、杭州。
-   主题：影视文化、空间文化、文化数字化、文化消费、产业要素、产业治理。
-   政策类型：规划/意见/办法/通知/行动方案/申报征集/资金公示/征求意见稿/实施细则/政策解读。
-   首页默认展示：近 30 天政策；国家级、北京、上海、杭州混合展示。
-   首页排序：临近截止的有效申报事项和经过审核的重大政策有限置顶，其余按发布日期倒序。
-   空间文化暂不建设单个文化空间项目数据库。
-   第一阶段不自动生成政策影响力评分，不将 AI
    摘要当作官方解释，不对地区做综合排名。

### 1.3 暂不纳入

-   纯宣传性新闻，除非包含明确政策文件、申报通知、资金公示或正式政策发布。
-   没有官方来源或可靠官方转载依据的二手解读。
-   无法确认发布主体和原文的社交媒体帖子。
-   单纯的活动预告、会议新闻、领导调研新闻，除非附有正式政策或可核验的政策措施。

------------------------------------------------------------------------

## 2. 信息架构

### 2.1 首页近期政策动态

每条卡片显示：

-   地区层级标签：国家级 / 北京 / 上海 / 杭州
-   标题
-   发布机构
-   发布日期
-   主题标签
-   政策工具标签（可选，最多展示 1--2 个）
-   三段式摘要：
    -   政策做了什么
    -   支持谁
    -   涉及什么产业方向
-   特殊标识（按条件出现）：重大政策、申报中、即将截止、内容更新
-   数据状态（至少可区分待核验、已核验、来源异常）
-   操作：查看详情、阅读政策原文

首页不显示完整政策条款、完整申报条件、全部附件或冗长解读；这些放在详情页。

### 2.2 政策追踪列表页

提供： - 关键词搜索：标题、文号、发布机构、摘要、标签 -
地区筛选：全部地区 / 国家级 / 北京 / 上海 / 杭州 - 主题筛选：全部主题 /
影视文化 / 空间文化 / 文化数字化 / 文化消费 / 产业要素 / 产业治理 -
类型筛选：全部类型 / 规划与指导 / 产业扶持 / 申报事项 / 资金公示 /
征求意见 / 实施细则 / 政策解读 - 时间筛选：近 7 天 / 近 30 天 / 近 90 天
/ 自定义 / 全部时间 - 状态筛选：有效 / 征求意见中 / 申报中 / 已截止 /
已废止或被替代 / 待核验 -
排序：默认推荐排序；可切换发布日期倒序、截止日期优先 - 分页或"加载更多"

### 2.3 政策详情页

建议显示： - 标题、地区、发布机构、文号、发布日期 -
生效日期、失效日期、政策状态（若可确认） - 官方原文链接 - 三段式摘要 -
主题标签、政策工具、扶持对象 - 申报开始/截止日期（如适用） -
关键条款（可选，必须能追溯到原文段落） -
关联文件：上位政策、实施细则、申报通知、修订文件、废止/替代文件 -
数据来源、最后核验时间、采集时间、核验状态 -
历史版本/更新记录（第一期可先显示最近一次更新）

------------------------------------------------------------------------

## 3. 数据模型建议

建议第一期至少包含以下实体：

1.  `policy_documents`：政策主记录。
2.  `policy_tags`：政策标签字典。
3.  `policy_document_tags`：政策与标签的多对多关系。
4.  `policy_relations`：政策之间的关联关系。
5.  `data_sources`：来源站点及采集配置。
6.  `policy_versions`：政策记录的版本/内容变更历史。
7.  `policy_review_events`：人工核验和状态变更日志。
8.  `ingestion_runs`：每次采集任务的执行记录。

若项目暂时使用 JSON 或本地 mock
数据，也应沿用下方字段语义，避免后续迁移时重新定义业务规则。

### 3.1 `policy_documents` 核心字段表

  ----------------------------------------------------------------------------------------------------------------------------------------------
  字段                       类型建议                          必填 说明 / 规则
  -------------------------- ---------------- --------------------- ----------------------------------------------------------------------------
  `id`                       UUID / string                       是 系统内部唯一 ID，不使用标题作为主键

  `title`                    string                              是 官方文件标题；保留原文标题，不自行改写

  `normalized_title`         string                              是 用于去重的标准化标题，去除多余空格、全半角差异等，不删除有意义的年份或文号

  `document_number`          string nullable                     否 文号；原文没有时为空，不虚构

  `region_level`             enum                                是 `national` / `beijing` / `shanghai` / `hangzhou`

  `region_name`              string                              是 国家级、北京市、上海市、杭州市等显示名称

  `issuing_agency`           string nullable                   推荐 发布机关；多机关联合发布时保存完整名称或关联机构表

  `published_at`             date nullable                     推荐 官方发布日期；未知时为空，不能用采集时间代替

  `effective_at`             date nullable                       否 生效日期

  `expires_at`               date nullable                       否 失效日期；只在原文或官方后续文件明确时填写

  `document_type`            enum                                是 见 4.2 类型枚举

  `policy_status`            enum                                是 见 4.3 状态枚举

  `summary_what`             text nullable                       否 政策做了什么

  `summary_who`              text nullable                       否 支持谁/适用对象

  `summary_industry`         text nullable                       否 涉及什么产业方向

  `summary_source_type`      enum                                是 `human` / `ai_draft` / `official_interpretation`

  `summary_review_status`    enum                                是 `pending` / `verified` / `rejected`

  `key_clauses`              JSON / related                      否 关键条款；建议保存原文摘录、条款位置、人工核验状态
                             table                                  

  `official_url`             URL                                 是 官方原文 URL；不得以搜索结果页代替文件原文页，除非官方原文只能在该页访问

  `source_id`                UUID / string                       是 对应 `data_sources.id`

  `source_published_url`     URL nullable                        否 发现该文件的来源列表页，可与原文链接不同

  `topic_tags`               relation / JSON                     是 主题标签，允许多选

  `tool_tags`                relation / JSON                     否 政策工具标签，允许多选

  `target_groups`            JSON / relation                     否 扶持对象标准化标签，如文化企业、影视制作机构、园区运营主体

  `is_major_policy`          boolean                             是 重大政策标识；默认 false，需有明确规则或人工审核

  `major_policy_reason`      text nullable                       否 重大政策判定理由；标记重大时必填

  `application_start_at`     date nullable                       否 申报开始日期

  `application_deadline`     date nullable                       否 申报截止日期；必须有官方依据

  `application_status`       enum                                是 `not_applicable` / `upcoming` / `open` / `closed` / `unknown`

  `homepage_pin_until`       timestamp                           否 首页置顶截止时间；用于限制长期置顶
                             nullable                               

  `related_policy_ids`       relation                            否 关联政策；建议实际使用 `policy_relations` 表

  `content_hash`             string nullable                     否 对规范化正文或元数据计算的哈希，用于检测内容变化

  `source_last_checked_at`   timestamp                           否 最近一次成功访问/核验来源的时间
                             nullable                               

  `collected_at`             timestamp                           是 系统采集时间

  `last_updated_at`          timestamp                           是 系统记录最近更新时间

  `verification_status`      enum                                是 `pending` / `verified` / `source_error` / `needs_review`

  `visibility_status`        enum                                是 `published` / `hidden` / `duplicate` / `archived`

  `duplicate_of_id`          UUID/string                         否 重复记录指向的主记录 ID
                             nullable                               

  `created_at`               timestamp                           是 系统创建时间

  `updated_at`               timestamp                           是 系统更新时间
  ----------------------------------------------------------------------------------------------------------------------------------------------

### 3.2 `data_sources` 来源表

  ------------------------------------------------------------------------------------------------------
  字段                   类型建议                          必填 说明
  ---------------------- ---------------- --------------------- ----------------------------------------
  `id`                   UUID/string                         是 来源 ID

  `source_name`          string                              是 来源名称，如中国政府网、国家电影局官网

  `region_level`         enum                                是 国家级 / 北京 / 上海 / 杭州

  `organization`         string nullable                     否 所属机构

  `base_url`             URL                                 是 官方站点首页或栏目首页

  `source_category`      enum                                是 `policy_portal` / `department_site` /
                                                                `government_bulletin` /
                                                                `official_notice`

  `priority`             integer                             是 来源优先级，数值越小优先级越高

  `enabled`              boolean                             是 是否启用采集

  `crawl_frequency`      enum                                是 `daily` / `weekly` / `manual`

  `access_method`        enum                                是 `rss` / `html` / `api` / `manual` /
                                                                `other`

  `last_success_at`      timestamp                           否 最近一次成功采集时间
                         nullable                               

  `last_error_at`        timestamp                           否 最近一次失败时间
                         nullable                               

  `last_error_message`   text nullable                       否 错误摘要，不存储敏感凭据

  `notes`                text nullable                       否 采集限制、栏目说明等
  ------------------------------------------------------------------------------------------------------

### 3.3 `policy_relations` 关联关系表

  --------------------------------------------------------------------------------------
  字段                 类型建议                          必填 说明
  -------------------- ---------------- --------------------- --------------------------
  `id`                 UUID/string                         是 关系 ID

  `source_policy_id`   UUID/string                         是 当前政策

  `target_policy_id`   UUID/string                         是 关联政策

  `relation_type`      enum                                是 `implements` / `amends` /
                                                              `replaces` / `repeals` /
                                                              `supplements` /
                                                              `application_notice_for` /
                                                              `interpretation_of`

  `evidence_note`      text nullable                       否 关联依据

  `verified`           boolean                             是 是否人工确认
  --------------------------------------------------------------------------------------

### 3.4 `policy_review_events` 核验日志表

  ------------------------------------------------------------------------------
  字段             类型建议                          必填 说明
  ---------------- ---------------- --------------------- ----------------------
  `id`             UUID/string                         是 日志 ID

  `policy_id`      UUID/string                         是 对应政策

  `event_type`     enum                                是 `summary_reviewed` /
                                                          `status_changed` /
                                                          `deadline_verified` /
                                                          `source_checked` /
                                                          `major_flag_changed` /
                                                          `duplicate_merged`

  `old_value`      JSON nullable                       否 变更前内容

  `new_value`      JSON nullable                       否 变更后内容

  `reviewer`       string nullable                     否 审核人或系统任务标识

  `note`           text nullable                       否 变更理由

  `created_at`     timestamp                           是 操作时间
  ------------------------------------------------------------------------------

------------------------------------------------------------------------

## 4. 枚举值与标签规则

### 4.1 地区层级

``` ts
type RegionLevel = "national" | "beijing" | "shanghai" | "hangzhou";
```

说明： - `national` 表示中央层级发布的政策。 -
北京、上海、杭州按政策发布主体和适用范围共同判断。 -
国家部委在地方开展的活动，不自动归为地方政策。 -
一份政策可能适用于全国，但由地方机构发布；以发布主体层级为主要归类依据，同时在详情页记录适用地区。

### 4.2 文件类型 `document_type`

``` ts
type PolicyDocumentType =
  | "plan_guideline"       // 规划、意见、指导意见
  | "action_plan"          // 行动方案、实施方案
  | "support_policy"       // 产业扶持、专项政策
  | "application_notice"   // 申报、征集、评选、项目申报通知
  | "funding_announcement" // 资金安排、资助结果、公示
  | "consultation"         // 征求意见稿
  | "implementation_rule"  // 实施细则、配套办法
  | "policy_interpretation"// 官方政策解读
  | "other";
```

### 4.3 政策状态 `policy_status`

``` ts
type PolicyStatus =
  | "in_force"       // 已发布且当前有效（须有依据）
  | "consultation"   // 征求意见中
  | "upcoming"       // 已发布但尚未生效
  | "expired"        // 明确到期
  | "repealed"       // 明确废止
  | "superseded"     // 被后续文件替代
  | "unknown";       // 状态无法确认
```

规则： - 不得仅因文件发布时间较早，就自动判定为废止或失效。 -
没有明确有效期或官方状态依据时，使用 `unknown`
或按经审核规则保留状态，不猜测。 - `application_status` 与
`policy_status` 分开维护。政策本身仍有效，但某次申报可能已截止。

### 4.4 主题标签 `topic_tags`

首期固定标签： - `film_tv`：影视文化，包括电影、电视剧、网络视听等。 -
`cultural_space`：空间文化，包括文化场馆、文化园区、演艺空间、文化空间运营等。 -
`cultural_digitalization`：文化数字化、数字内容、文化科技应用。 -
`cultural_consumption`：文化消费、文化场景、消费促进。 -
`industry_factors`：人才、资金、技术、土地、设施、企业服务等产业要素。 -
`industry_governance`：行业管理、市场秩序、标准、审批、监管等。 -
`public_culture`：公共文化服务与公共文化设施。 -
`heritage`：文化遗产、非遗及相关产业应用。

规则： - 一条政策可有多个主题标签。 -
首页默认最多展示两个主题标签，更多标签放入详情页。 -
标签应基于正文实质内容，而不是仅凭标题关键词判断。 -
不能明确判断时，保留人工待审核状态，不强行打标签。

### 4.5 政策工具标签 `tool_tags`

首期固定标签： - `fiscal_support`：财政资金、补贴、奖励、资助。 -
`tax_finance`：税收、融资、金融支持。 -
`space_facility`：空间、场地、设施、园区支持。 -
`talent_innovation`：人才、创新、技术研发。 -
`market_development`：市场培育、展演展映、消费促进、渠道建设。 -
`regulation_standard`：行业监管、准入、标准、规范。 -
`public_service`：公共服务、公共文化服务供给。 -
`project_selection`：项目征集、评选、认定、示范创建。

### 4.6 摘要字段规则

`summary_what`：说明政策采取了什么措施或提出了什么制度安排。\
`summary_who`：说明适用对象、支持对象或申报主体；如未明确，填写"原文未明确具体对象"，不要猜测。\
`summary_industry`：说明对应的产业方向，优先使用统一标签词汇；可以补充简短解释。

要求： - 摘要使用中性、可核验的语言。 -
不将政策目标写成已经实现的产业效果。 -
不从政策文本推导未明示的资金规模、申报资格或受益范围。 - AI
可生成草稿，但默认 `summary_review_status = pending`。 -
对外展示的摘要应在核验后标记为
`verified`；若暂未核验，应显示"摘要待核验"或采用已确认的元数据。 -
摘要应尽量简洁：每个字段建议 1--3 句；首页卡片每项建议不超过约 80
个中文字符。

------------------------------------------------------------------------

## 5. 首页排序规则

### 5.1 排序原则

采用分层排序，不建立难以解释的综合评分：

1.  符合置顶条件的有效申报事项；
2.  经过审核的重大政策；
3.  其他常规政策，按 `published_at` 倒序；
4.  已截止、废止、被替代或历史政策默认不进入首页常规动态流。

### 5.2 申报事项置顶资格

满足全部条件才可进入申报提醒区： -
`document_type = application_notice`，或其他经审核确认包含明确申报安排的文件类型； -
`application_deadline` 有官方原文依据； -
`application_status = open`； - 当前时间早于截止日期； -
`verification_status = verified`，或截止日期已由人工核验； -
记录没有被隐藏、合并为重复记录或标记为无效。

建议提醒窗口： - 截止日期在 0--3 天内：`deadline_urgent` - 截止日期在
4--7 天内：`deadline_soon` - 截止日期在 8--30
天内：`deadline_upcoming` - 超过 30 天：不额外显示紧迫标签 -
已截止：`closed`，退出有效申报提醒区

以上天数是产品规则，可在配置文件中调整。日期计算应统一使用
`Asia/Shanghai` 时区。

### 5.3 重大政策资格

`is_major_policy = true` 必须满足： -
由人工审核，或经明确规则初筛后由人工确认； - `major_policy_reason`
必填； -
可考虑的判定依据：国家或地方政府正式发布的综合性规划/行动方案、跨部门产业政策、具有明确资金或制度安排的关键政策、对影视文化或空间文化产生直接且广泛影响的正式文件。 -
不仅因为标题包含"重大""重磅"等宣传词就认定为重大政策。

### 5.4 置顶限制

-   重大政策必须设置 `homepage_pin_until`，建议默认置顶 7
    天，管理员可调整。
-   申报事项按截止日期动态排序，不因"置顶"而忽略已经截止的状态。
-   首页置顶区域建议最多 3
    条；超出时优先展示更临近截止的申报事项，其次展示最近发布的重大政策。
-   置顶只影响首页排序，不改变政策发布日期。
-   普通政策始终按发布日期倒序；发布日期相同则按采集时间或内部稳定排序键排序。
-   `published_at`
    为空的记录默认不进入首页常规流，除非人工确认并明确标注"发布日期待核验"。

### 5.5 建议排序伪代码

``` ts
function getHomepagePriority(policy, now) {
  if (!isVisible(policy)) return "hidden";

  if (isVerifiedOpenApplication(policy, now)) {
    const daysLeft = daysUntil(policy.application_deadline, now);
    return {
      tier: 1,
      urgency: daysLeft, // 越小越靠前
    };
  }

  if (
    policy.is_major_policy &&
    policy.major_policy_reason &&
    policy.homepage_pin_until &&
    new Date(policy.homepage_pin_until) > now &&
    policy.verification_status === "verified"
  ) {
    return { tier: 2, urgency: 0 };
  }

  if (isHistoricalOrInactive(policy)) {
    return "exclude_from_homepage";
  }

  return { tier: 3, publishedAt: policy.published_at };
}
```

实现注意： - `daysUntil` 必须处理时区、日期边界和空值。 -
`isHistoricalOrInactive` 不能将 `unknown` 自动当作失效。 -
置顶和截止日期逻辑必须有单元测试。

------------------------------------------------------------------------

## 6. 筛选与搜索规则

### 6.1 首页默认筛选

-   地区：全部地区
-   主题：全部主题
-   类型：全部类型
-   时间：近 30 天
-   关键词：空
-   排序：申报提醒 / 重大政策有限置顶，其余按发布日期倒序

### 6.2 搜索字段

默认搜索： - `title` - `document_number` - `issuing_agency` -
`summary_what` - `summary_who` - `summary_industry` -
已关联主题和政策工具标签

建议第一期使用数据库的基础文本搜索或轻量模糊匹配；暂不需要引入独立搜索服务。

### 6.3 筛选组合逻辑

不同筛选维度之间采用 AND： - 地区 AND 主题 AND 类型 AND 时间 AND 状态
AND 关键词。

同一维度多选时采用 OR： - 主题为影视文化或空间文化。

筛选状态应体现在 URL query
参数中，以便刷新、复制链接和从首页跳转政策库时保留筛选条件。

### 6.4 空结果处理

当筛选后无结果： - 显示"没有匹配的政策记录"； - 提供"清除筛选"操作； -
不显示错误警告； - 不自动放宽筛选条件； -
不将无结果解释为该地区或主题没有相关政策。

------------------------------------------------------------------------

## 7. 异常状态与前端文案

  -------------------------------------------------------------------------------------------------------
  异常场景           状态值建议           前端文案               处理规则
  ------------------ -------------------- ---------------------- ----------------------------------------
  来源采集失败       `source_error`       来源暂时无法同步       保留历史数据，记录失败时间并重试

  摘要未核验         `summary_pending`    摘要待核验             可显示已确认元数据；摘要明确标记待核验

  原文链接无法访问   `link_unavailable`   原文暂不可访问         保留 URL
                                                                 和错误日志，不擅自替换为非官方链接

  截止日期不明       `deadline_unknown`   截止日期待确认         不显示剩余天数，不发出精确提醒

  申报已截止         `closed`             已截止                 从有效申报提醒区移除，保留历史记录

  政策状态不明       `unknown`            政策状态待确认         不自动认定有效或失效

  政策已废止         `repealed`           已废止                 默认退出首页常规流，详情页保留

  被新文件替代       `superseded`         已被后续文件替代       关联替代文件，保留历史记录

  可能重复           `needs_review`       记录待去重             暂不直接删除，待人工确认主记录

  无匹配结果         不适用               没有匹配的政策记录     显示清除筛选入口

  数据加载失败       UI 状态              暂时无法加载政策列表   显示重试按钮；不要显示为"暂无政策"
  -------------------------------------------------------------------------------------------------------

注意：上表中的前端显示状态与数据库枚举不是一一对应。建议把"来源状态""摘要核验状态""政策状态""申报状态""前端加载状态"分别建模，避免一个字段承担多个含义。

------------------------------------------------------------------------

## 8. 去重、版本和关联政策

### 8.1 去重规则

建议按以下顺序识别疑似重复： 1. 官方原文 URL 规范化后相同； 2.
文号相同且发布机构相同； 3. 标准化标题相同、发布机构相同、发布日期相近；
4. 标题相似度高，进入人工复核。

不要只凭标题相似度自动删除记录。联合发文、转载、修订版、附件更新可能存在相似标题但内容不同的情况。

### 8.2 记录更新

如果同一官方页面正文或附件发生变化： - 更新 `content_hash`； - 记录
`last_updated_at` 和 `source_last_checked_at`； - 在 `policy_versions`
中保存关键字段的旧值和新值； - 对摘要、截止日期、政策状态变化创建
`policy_review_events`； -
首页可短期显示"内容更新"，但不应把旧文件的原发布日期改成今天。

### 8.3 政策关系

至少支持： - 上位政策 → 实施细则 - 政策 → 申报通知 - 政策 → 官方解读 -
原政策 → 修订文件 - 旧政策 → 替代文件 - 原政策 → 废止文件

------------------------------------------------------------------------

## 9. 官方来源与采集规则

### 9.1 来源优先级

优先使用： 1. 文件发布机关的官方原文页面； 2.
中国政府网、国务院政策文件库、政府公报等官方汇集页面； 3.
地方政府门户、地方政府公报及对应主管部门官网； 4.
其他政府部门官方转载页面（用于补充或交叉核验）。

来源示例（开发时需逐步补齐北京、上海、杭州的具体栏目 URL）： -
中国政府网：https://www.gov.cn/ -
国务院政策文件库：https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary -
国务院部门文件库：https://www.gov.cn/zhengce/zhengceku/bmwj/home.htm -
文化和旅游部：https://www.mct.gov.cn/ -
国家电影局：https://www.chinafilm.gov.cn/ -
国家统计局政策公开栏目：https://www.stats.gov.cn/gk/

来源栏目 URL
可能调整。应把来源配置保存在数据库或配置文件中，不要把所有网址硬编码在
UI 组件内。

### 9.2 采集频率

-   政策来源：每日扫描；
-   重要申报来源：可按需要提高扫描频率，但须遵守网站访问规则；
-   每周进行一次去重、摘要和标签复核；
-   每月复核来源栏目可访问性和采集覆盖；
-   页面显示"最后成功同步时间"，不能只显示计划任务时间。

### 9.3 采集任务流程

``` text
读取已启用来源
  -> 获取列表页 / RSS / API
  -> 解析候选政策链接
  -> 访问官方原文页
  -> 提取标题、机构、日期、文号、正文、附件链接
  -> 规范化 URL 与文本
  -> 去重检查
  -> 保存原始元数据与正文快照
  -> 生成摘要/标签草稿（可选）
  -> 规则校验与人工核验
  -> 更新政策状态与申报截止状态
  -> 进入首页或政策库
  -> 写入采集日志
```

开发规则： - 采集器必须有超时、重试、限速和错误日志。 -
采集失败不得清空既有数据。 -
仅当来源页面成功访问并完成解析后，才更新"最后成功同步时间"。 - 对不稳定
HTML 结构应有解析失败告警。 - 遵守目标站点的
robots、使用条款和合理访问频率。 -
不绕过登录、验证码或访问控制；遇到无法自动访问的来源，改为人工录入或官方开放接口。

### 9.4 摘要生成与人工审核

AI 摘要只作为草稿： -
输出严格限定在三个字段：`summary_what`、`summary_who`、`summary_industry`。 -
重要事实应附原文依据或条款位置。 -
不确定的字段输出空值或"原文未明确"，不得补写。 -
对资金金额、申报资格、截止日期、生效日期、废止状态，必须基于原文核验。 -
第一阶段可先人工录入和人工核验，之后再逐步接入模型辅助。

------------------------------------------------------------------------

## 10. 数据状态字段的职责边界

建议不要把所有状态压缩到一个枚举中。

  -----------------------------------------------------------------------------------------------------------
  状态维度                  推荐字段                  示例
  ------------------------- ------------------------- -------------------------------------------------------
  政策本身的法律/业务状态   `policy_status`           `in_force`、`repealed`、`unknown`

  申报进度                  `application_status`      `open`、`closed`、`unknown`

  摘要审核                  `summary_review_status`   `pending`、`verified`、`rejected`

  整条记录的核验状态        `verification_status`     `pending`、`verified`、`needs_review`、`source_error`

  前台是否显示              `visibility_status`       `published`、`hidden`、`duplicate`、`archived`

  来源同步健康度            `data_sources`            最近成功时间、最近错误时间
                            上的运行字段              

  页面请求状态              前端临时状态              `loading`、`success`、`empty`、`error`
  -----------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 11. 建议的 TypeScript 类型

以下类型用于前端和 API 的初始契约，可按项目现有架构调整。

``` ts
export type RegionLevel =
  | "national"
  | "beijing"
  | "shanghai"
  | "hangzhou";

export type PolicyDocumentType =
  | "plan_guideline"
  | "action_plan"
  | "support_policy"
  | "application_notice"
  | "funding_announcement"
  | "consultation"
  | "implementation_rule"
  | "policy_interpretation"
  | "other";

export type PolicyStatus =
  | "in_force"
  | "consultation"
  | "upcoming"
  | "expired"
  | "repealed"
  | "superseded"
  | "unknown";

export type ApplicationStatus =
  | "not_applicable"
  | "upcoming"
  | "open"
  | "closed"
  | "unknown";

export type ReviewStatus =
  | "pending"
  | "verified"
  | "rejected";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "source_error"
  | "needs_review";

export type VisibilityStatus =
  | "published"
  | "hidden"
  | "duplicate"
  | "archived";

export interface PolicyDocument {
  id: string;
  title: string;
  normalizedTitle: string;
  documentNumber?: string | null;

  regionLevel: RegionLevel;
  regionName: string;
  issuingAgency?: string | null;

  publishedAt?: string | null; // ISO date: YYYY-MM-DD
  effectiveAt?: string | null;
  expiresAt?: string | null;

  documentType: PolicyDocumentType;
  policyStatus: PolicyStatus;
  applicationStatus: ApplicationStatus;

  summaryWhat?: string | null;
  summaryWho?: string | null;
  summaryIndustry?: string | null;
  summaryReviewStatus: ReviewStatus;

  topicTags: string[];
  toolTags: string[];
  targetGroups: string[];

  officialUrl: string;
  sourceId: string;

  applicationStartAt?: string | null;
  applicationDeadline?: string | null;

  isMajorPolicy: boolean;
  majorPolicyReason?: string | null;
  homepagePinUntil?: string | null;

  verificationStatus: VerificationStatus;
  visibilityStatus: VisibilityStatus;

  sourceLastCheckedAt?: string | null;
  collectedAt: string;
  lastUpdatedAt: string;
}
```

注意：数据库中可以使用 snake_case，TypeScript 使用 camelCase；在 API
层统一转换。所有日期时间应使用 ISO 格式，并明确时区。

------------------------------------------------------------------------

## 12. API 建议

首期可先实现以下接口，具体路径可根据现有项目调整。

  -----------------------------------------------------------------------------------------------------------------
  方法                    路径                               用途
  ----------------------- ---------------------------------- ------------------------------------------------------
  `GET`                   `/api/policies`                    获取政策列表，支持筛选、搜索、排序、分页

  `GET`                   `/api/policies/:id`                获取政策详情

  `GET`                   `/api/policy-facets`               获取地区、主题、类型、状态等筛选项

  `GET`                   `/api/policy-sync-status`          获取来源同步时间、异常数和任务状态

  `POST`                  `/api/admin/policies`              管理员创建/导入政策（需要权限控制）

  `PATCH`                 `/api/admin/policies/:id`          修改摘要、标签、状态、置顶和核验信息（需要权限控制）

  `POST`                  `/api/admin/policies/:id/review`   写入核验结果和审核日志（需要权限控制）
  -----------------------------------------------------------------------------------------------------------------

### 12.1 列表接口参数示例

``` text
GET /api/policies?region=national&topic=film_tv&type=application_notice&days=30&q=影视&page=1&pageSize=20
```

推荐返回结构：

``` ts
interface PolicyListResponse {
  items: PolicyDocument[];
  page: number;
  pageSize: number;
  total: number;
  appliedFilters: Record<string, unknown>;
}
```

所有管理员接口必须进行服务端权限校验，不能只依赖前端隐藏按钮。

------------------------------------------------------------------------

## 13. 第一阶段实现顺序

### P0：先做数据契约和静态展示

-   创建 TypeScript 类型和枚举；
-   用 8--12 条明确标记为 mock 的样例记录填充 UI；
-   完成政策卡片、列表、筛选、详情布局；
-   确认空状态、加载失败和待核验状态；
-   mock 数据不能混入真实数据统计。

### P1：接入真实数据的基础能力

-   创建来源配置；
-   支持手动录入或 CSV/JSON 导入；
-   完成 URL 规范化、基础去重和数据核验字段；
-   所有真实政策必须包含官方原文 URL。

### P2：采集自动化

-   按来源逐一实现采集器；
-   每日定时运行；
-   保存采集任务日志；
-   解析失败时保留旧数据并记录异常；
-   先从结构稳定的官方栏目开始，不要一次性抓取所有网站。

### P3：摘要与状态管理

-   接入摘要草稿生成（可选）；
-   建立人工核验流程；
-   建立政策关联关系和版本记录；
-   增加申报截止提醒与重大政策置顶。

------------------------------------------------------------------------

## 14. 验收标准

第一期政策模块至少满足：

-   [ ] 国家级、北京、上海、杭州四种地区筛选正确。
-   [ ] 主题、类型、时间、关键词筛选可组合使用。
-   [ ] 首页默认近 30 天，普通政策按发布日期倒序。
-   [ ] 置顶政策有原因和截止时间，不会永久置顶。
-   [ ] 申报截止日期未经核验时，不显示倒计时。
-   [ ] 已截止申报不再出现在有效申报提醒区。
-   [ ] 原文 URL 可打开；失效时显示明确状态。
-   [ ] 未核验摘要有状态标记。
-   [ ] 重复记录不会在首页重复展示。
-   [ ] 已废止/被替代政策保留历史记录并关联后续文件。
-   [ ] 来源采集失败不会删除或覆盖已有有效数据。
-   [ ] 发布日期、采集时间、最后核验时间相互独立。
-   [ ] 空结果与加载错误显示不同提示。
-   [ ] mock 数据明确标识，不冒充真实政策。
-   [ ] 管理接口有服务端权限控制。
-   [ ] 所有展示字段可追溯到来源或明确标记为人工摘要。

------------------------------------------------------------------------

## 15. 官方来源参考

以下为首期来源配置的起点。实际开发时，应逐步补齐北京、上海、杭州政府门户、政府公报和主管部门的具体政策栏目链接，并在来源表中维护，而不是将采集逻辑写死在页面中。

-   中国政府网：https://www.gov.cn/
-   国务院政策文件库：https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary
-   国务院部门文件库：https://www.gov.cn/zhengce/zhengceku/bmwj/home.htm
-   文化和旅游部：https://www.mct.gov.cn/
-   国家电影局：https://www.chinafilm.gov.cn/
-   国家统计局政策公开栏目：https://www.stats.gov.cn/gk/

来源页面和栏目结构可能变化，采集器应具备错误日志、重试与人工补录机制。官方来源的具体优先级应按文件发布机关和原文可访问性确定，而不是只按域名判断。

------------------------------------------------------------------------

## 16. 给 VS Code 编程助手的任务说明

请先阅读项目现有目录和技术栈，不要直接重写整个项目。按以下顺序实施：

1.  对照本文建立或更新 `src/types/policy.ts`，定义枚举和
    `PolicyDocument` 类型。
2.  建立
    `src/lib/policy-rules.ts`，实现地区/主题/类型筛选、日期窗口、申报状态、重大政策置顶资格、普通政策倒序和去重辅助函数。
3.  建立 `src/lib/mock-policies.ts`，提供 8--12 条虚构 mock
    记录；每条记录必须标记 `isMock: true` 或由数据源统一标记为 mock，UI
    明确显示"示例数据"。
4.  实现首页近期政策卡片和政策列表页。筛选条件之间按 AND
    组合，同一维度多选按 OR 组合。
5.  实现政策详情页基础字段与官方原文入口。
6.  实现加载中、空结果、请求失败、摘要待核验、原文不可访问、申报已截止等状态。
7.  为日期排序、截止提醒、置顶过期、筛选组合和重复记录识别编写单元测试。
8.  不要在本阶段假设已存在真实政策 API；真实采集、数据库和定时任务应在
    UI 与数据契约稳定后接入。
9.  不要把 `unknown` 当成有效、失效或 0；不要使用采集时间替代发布日期。
10. 修改前先列出将要新增或修改的文件，尽量沿用项目已有结构和组件。

交付时请提供： - 修改文件清单； - 实现内容摘要； - 本地运行命令； -
测试命令与测试结果； - 尚未实现的真实采集、数据库和定时任务清单。

---

## 17. 与总方案的衔接（2026-10 补充）

本文件只定义**模块 A 政策追踪**。以下内容不在本文件展开，统一见《文化产业观察站_一期总方案.md》：

- 模块 B 影视文化产业监测的指标字典、口径、来源等级与数据缺口处理；
- 两个模块之间的关联方式与统一数据规范（区域码、状态字段、三类数据分层）；
- 一键更新与定时更新的执行机制、日志字段；
- 页面信息架构与全局交互。

> 2026-10 范围调整：**空间文化数据库模块已从第一期移除**。空间文化仅作为政策主题标签保留，不再对应独立的名录与运营数据模块。

### 17.0 一期不做人工核验

页面为静态产物，可在手机、平板、电脑跨端打开，**不提供站内人工核验入口**。因此：

- 抓取入库的记录一律视为「名录条目」，只保证标题、机构、日期、原文链接；
- `summaryReviewStatus` 不再对外展示，摘要仅作检索参考，页面统一说明「自动抽取」；
- 需要修正时，直接修改 `data/policies.json` 或重新抓取，再执行构建；
- §3.4 `policy_review_events`、§10 的核验状态维度保留在数据模型中，供后续接入后台时使用。

### 17.1 本文件的一期适用条款变更

| 条款 | 一期处理 |
|---|---|
| §2.1 首页近期动态 | 保留卡片结构，**取消申报提醒置顶区** |
| §2.1 卡片操作 | **取消「查看详情」**：标题即官方原文外链，点击直接跳转，不在站内渲染详情 |
| §2.2 列表页筛选 | 保留关键词 / 地区 / 主题 / 类型 / 仅看重点政策；**取消时间筛选与状态筛选**（状态字段保留但不驱动筛选） |
| §2.2 列表页分页 | **取消分页与「加载更多」**，固定展示排序后前 60 条；需要更多时用筛选缩小范围，并提供当前筛选结果的 CSV 导出 |
| §2.3 政策详情页 | **一期不实现**。摘要、关键条款、关联文件等字段保留在数据模型中，等接入后台后再启用 |
| §5.1–5.5 排序与置顶 | 改为「重点政策优先 + 发布日期倒序」，取消 §5.2 申报置顶资格 |
| §4.3 policy_status | 继续使用；application_status 保留字段但不再驱动首页排序 |
| §2.2 地区筛选 | 增加 zhejiang（浙江省）。**本文件其余位置凡并列「国家级 / 北京 / 上海 / 杭州」之处，一律按「国家级 / 浙江省 / 北京 / 上海 / 杭州」理解**，以 §17.2 的枚举为准 |
| §13 实施顺序 | P0/P1 已完成；P2 采集自动化为当前阶段 |
| 空间文化 | 原空间模块（名录、运营指标、地图）整体移出一期；仅保留 cultural_space 政策标签 |

### 17.2 新增枚举值

```ts
// 在原 RegionLevel 基础上增加
export type RegionLevel =
  | "national"
  | "zhejiang"
  | "beijing"
  | "shanghai"
  | "hangzhou";
```

### 17.3 重点政策字段

```ts
export interface KeyPolicyFlag {
  isKeyPolicy: boolean;
  keyPolicyRule?: string;        // 命中的规则编号，便于解释
  keyPolicyConfirmedBy?: string; // 人工确认人，未确认为空
}
```

判定规则与展示方式见总方案 §4.2。