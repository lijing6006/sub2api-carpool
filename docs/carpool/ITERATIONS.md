# 拼车版迭代记录 / Carpool iteration log

**中文说明：** 每个版本都是独立提交的实际功能改进，附验证结果。开发期间未访问生产服务、未调用付费模型。上游基线为 v0.2.19；后续尚未完成的项目不会写成已通过。

Upstream baseline: `v0.2.19`, `dece26153621959ccd7635814f4b2d08304e681a`.
Each version below is a substantive, separately committed increment. No production service or paid model was called during development.

## 版本 01：管理员用量工作台 / Administrator usage workspace

- 蓝白控制台、真实每日用量与模型占比、费用/Token/请求排行、明确 Top 200 上限、CSV 导出。
- 管理员路由权限、Simple Mode 限制、请求取消/竞态、空/失败状态、表格公式注入防护均纳入验证。
- 28 项统计测试、5 项实际路由守卫测试通过；首次整合全量 381 文件 / 3076 项前端测试、ESLint、生产构建通过。
- 上游自动发布与 CLA 工作流移出活跃目录，不触发部署。真实浏览器视觉检查因执行器 IPC/网络隔离受阻，不冒充通过。

**English**

- Blue/white responsive workspace, administrator-only menu and actual route guard.
- Real daily usage aggregates, model cost share, selectable cost/token/request ranking (explicit Top 200 limit), date validation and CSV export.
- Actual member charges are distinguished from upstream procurement costs; no invented shared budgets or sample runtime metrics.
- Cancel and stale-response protection; separate empty, loading and partial-error states; spreadsheet formula-injection defense.
- Simple Mode cannot enter this billing-dependent workspace.
- Upstream release/publishing and CLA automation are preserved outside GitHub’s active workflows directory. Security checks run on code changes, not an unsolicited weekly schedule; CI remains read-only.
- Validation: 28 analytics/helper tests and 5 actual route-guard tests passed; existing feature-access tests also passed. First integrated frontend baseline: 381 files / 3,076 tests passed, full ESLint passed, production build (including i18n and `vue-tsc -b`) passed. Each later increment is rechecked separately.
- Browser rendering remains blocked by the execution environment: Chromium IPC socket permission failure; normal escalation failed in runner initialization. The separate supported cloud-browser tab cannot reach this executor's localhost. This is not presented as successful visual QA.

## 版本 02：成员、订阅与安全余额操作 / Members, subscriptions and safe balance adjustments

- 支持分页搜索、状态筛选、当前订阅与到期时间、直接分配订阅及已有额度配置入口。
- 订阅与余额可以并存；充值必须填写审计备注。余额写入有管理员隔离的幂等键，未知结果先核对，关闭重开也不能重复记账。
- 23 项成员/API/幂等测试与 3 项中英文完整性检查通过，相关文件 ESLint 通过。

**English**

- Added the Members & subscriptions workspace: paginated search, status filtering, current subscriptions/expiry, direct subscription assignment and existing quota/plan configuration links.
- Subscription and balance are not mutually exclusive; the API key's selected group determines billing. No new payment processor or fictitious monthly balance quota.
- Balance additions require an audit note and a stable, administrator-scoped idempotency key. Uncertain outcomes must be reconciled before retrying the same operation; close/reopen/navigation cannot silently create a second charge.
- Validation: 23 member/API/idempotency tests passed; zh/en key completeness passed (26 tests together); all changed module files and the integrated workspace passed ESLint. Existing shared `updateBalance` callers remain compatible through an optional fifth argument.


## 版本 03：真正的临时账号服务端约束 / Server-enforced temporary accounts

- 新增账号到期时间、累计美元额度、累计实际扣费；独立于余额/订阅，充值、换 Key、换订阅均不会清零。
- 新建临时账号必须同时设置期限和额度；不可创建/升级为管理员，不将已有用户悄悄转为临时账号。
- 认证快照升级 v26；每次网关请求重读数据库约束。到期 JWT/刷新被拒绝，正在进行的请求受到期 deadline 约束。
- 同一幂等计费事务累计额度；失去统一计费路径时拒绝降级。仅允许已审核的同步请求；WebSocket、background、异步及未知接口关闭。
- **边界：这是请求结算后的软限额，在途/待结算请求可能超额。没有伪称硬封顶。**
- 验证：临时账号 15 个顶层测试全部通过；联合回归四个 Go 包共 97 顶层 / 121 含子例 PASS。PostgreSQL 真实迁移和并发负载尚未运行（本环境无数据库/Docker），SQL mock 不替代实库测试。

**English**

- Added user-wide expiry, cumulative USD budget and cumulative actual spend, independent of balance/subscriptions and unchanged by key rotation or top-ups.
- New temporary members require both expiry and budget; administrator escalation and converting existing users are rejected.
- Auth snapshot v26 includes policy; gateway checks re-read authoritative usage. Expired JWT/refresh is rejected and in-flight requests have an expiry deadline.
- The meter updates inside the existing idempotent billing transaction. Non-idempotent fallback fails closed. Only audited synchronous routes are allowed; WebSocket/background/async/unknown routes are blocked.
- **Post-request soft cap, not a reserved hard ceiling: in-flight or unsettled usage can overshoot.**
- Validation: 15 temporary-account top-level tests passed; combined Go regression passed 4 packages, 97 top-level / 121 including subtests. Real PostgreSQL migrations/concurrency were not run because this environment has no database/Docker; SQL mocks do not substitute for those checks.

## 版本 04：临时账号管理界面 / Temporary-member controls

- 新增临时账号页：创建、延期、修改消费额度、启停、搜索与分页；余额与累计消费上限分别展示。
- 密码仅用于管理员明确创建账号，取消/成功后清空；不生成 API Key、不自动发送凭证、不盲目重试不确定写入。
- 界面明确同步入口白名单与软限额；修改额度不会重置消费。
- 验证：10 项临时成员组件测试再次全部通过，相关界面/API/工作台 ESLint 通过。

**English**

- Added creation, extension, budget editing, enable/disable, search and pagination. Prepaid balance and cumulative spending budget are displayed separately.
- Passwords are cleared on cancel/success. No automatic API-key generation, credential delivery or uncertain-write retry.
- The UI states supported synchronous routes and soft-cap semantics; changing the cap does not reset spending.
- Validation: all 10 temporary-member component tests re-passed, as did ESLint for the interface, API and integrated workspace.

## 版本 05：真实模型检测协议 / Measured model diagnostic protocol

- 既有管理员测试接口增加兼容的 diagnostic 模式，固定小题、显式费用确认、60 秒与 4 KB 输出限制。
- 独立返回服务端观察的首字/总耗时、上游报告的输出 Token；没有真实用量时不估算吞吐。
- 诊断不修改账号健康状态，不自动重试/恢复账号；原检测默认模式保持兼容。拒绝媒体模型及大小写别名映射绕过；错误不回显凭证。
- 验证：11 项新诊断顶层测试、71 项原账号检测回归与 15 项临时策略测试联合通过（四包 97 顶层 / 121 含子例）；全部为 mock，未调用真实模型。

**English**

- Extended the existing administrator test endpoint with a backward-compatible diagnostic mode: fixed fixture, explicit cost consent, 60-second deadline and 4 KB output bound.
- Reports server-observed first-text/total latency and provider-reported output tokens. Missing usage never becomes an invented throughput estimate.
- Diagnostics neither repair health state nor silently retry accounts; normal tests retain their behavior. Media models and case-sensitive alias bypasses are rejected, and raw errors cannot expose credentials.
- Validation: 11 diagnostic, 71 existing account-test and 15 temporary-policy top-level tests passed together (4 packages, 97 top-level / 121 including subtests). All use mocks; no real model was invoked.

## 版本 06：模型检测工作台 / Model diagnostics workspace

- 管理员手动选账号与模型，逐次确认费用后运行；取消、离开页面和旧响应均有隔离，不定时调用。
- 展示可用性、首字延迟、总耗时、真实输出 Token 与吞吐；无元数据时显示未知，不由字符数推算。
- 固定 JSON 小题按三个公开检查评分，明确不是模型智力排名；本会话最多保留八条记录。
- 验证：19 项检测工具/组件及原账号测试弹窗回归全部通过；相关 ESLint 通过。没有真实模型调用。

**English**

- Administrators explicitly select an account/model and acknowledge cost for each run. Cancellation, unmount and stale responses are isolated; no scheduled calls.
- Separates availability, first-text latency, total duration, actual output tokens and throughput. Missing metadata remains unknown rather than estimated from characters.
- A fixed JSON fixture has three transparent checks, not an intelligence ranking. History is limited to eight runs in the current session.
- Validation: all 19 diagnostic utility/component and existing account-test dialog regression tests passed, as did targeted ESLint. No real model was called.

## 版本 07：旧客户端兼容 / Existing-client compatibility

- 全量后端回归发现普通成员响应意外增加三个临时字段，修复为只向临时成员返回；临时成员零消费仍明确返回 0。
- 新增 shallow/full/admin 三种映射和零/非零消费序列化回归；既有 API 合约恢复通过。
- 验证：DTO 全包通过；DTO 定向测试和服务端 TestAPIContracts 通过。全后端首轮还发现三个既有 Aliyun 验证码测试超时，未伪称全绿，继续隔离检查。

**English**

- Full backend regression found three temporary fields leaking into ordinary-member response shapes. They now appear only for temporary members, including an explicit zero spend.
- Added serialization coverage across shallow/full/admin mappings and zero/nonzero spending; the existing API contract is restored.
- Validation: the complete DTO package and targeted DTO/server API-contract tests passed. The initial full suite also found three pre-existing Aliyun CAPTCHA test timeouts; those remain separately investigated, not reported as a full pass.

## 版本 08：可公开分发的安全配置 / Safe distribution configuration

- 移除继承的 OAuth 客户端秘密、数据库弱默认和文档字面口令；OAuth 改为明确配置，无配置时失败关闭。
- 移除未使用的上游 Release/CLA/镜像发布工具和关联 CI 任务，只保留只读验证。原许可证与署名保留。
- 新增中文优先、完整英文对应的项目入口，解释软限额、费用、权限和配置边界。
- 验证：Antigravity、Gemini CLI 和 config 三包单元测试通过；缺少 OAuth 配置两例改为验证拒绝；源树凭据形态扫描无匹配、diff whitespace 检查通过。此扫描不等于完整安全认证。此前不安全历史不得公开，发布使用一致安全覆盖并记录 SHA 映射。

**English**

- Removed inherited OAuth client secrets, weak database defaults and literal documentation passwords. OAuth requires explicit configuration and fails closed when missing.
- Removed unused upstream release/CLA/image-publishing tools and their CI references; retained read-only validation, license and attribution.
- Added Chinese-first/English project documentation explaining soft caps, cost, permissions and configuration requirements.
- Validation: Antigravity, Gemini CLI and configuration unit packages passed, including two missing-OAuth rejection checks. Source credential-pattern and whitespace checks passed; these are not a full security certification. Unsafe earlier history must not be published; publication uses a consistent safety overlay with recorded SHA mapping.

## 版本 09：可操作的成员提醒 / Actionable member attention

- 总览追加低余额与未来七天订阅到期提醒；余额提醒阈值可本地调整，排除有有效订阅的普通成员。
- 每来源最多检查 100 条、明确排序与覆盖边界；非法日期保守排除，失败显示未知而非零条。
- 两路独立刷新/重试、取消与旧响应保护，直达成员和订阅管理；不自动续费、扣款或通知用户。
- 验证：16 项提醒组件测试与 3 项双语完整性测试通过，集成组件/locale/工作台 ESLint 通过。

**English**

- Added low-balance and next-seven-day subscription-expiry attention cards. The local reminder threshold is adjustable; members with valid subscriptions are excluded from prepaid-only reminders.
- Each source inspects at most 100 sorted records with explicit coverage limits. Invalid dates are excluded conservatively; failures remain unknown, not zero.
- Independent refresh/retry, cancellation and stale-response guards; direct management links. No automatic renewal, billing or notifications.
- Validation: 16 component and 3 bilingual-completeness tests passed, along with ESLint for the integrated component, locales and workspace.

## 版本 10：可保留的分析筛选 / Restorable analytics filters

- 时段、日期和指标写入页面链接，切换管理页不会丢失；浏览器前进/后退恢复筛选，只触发一次成对数据读取。
- 校验未知/重复参数、非法日期和超长区间；成员搜索留在本地，不把邮箱写进链接。
- 链接更新失败有明确提示，但不阻断数据查看；自定义日期只在确认后生效。
- 验证：48 项筛选、统计、组件和双语测试通过；相关 ESLint 通过，覆盖初始链接、导航恢复、重复查询、敏感搜索不入 URL、导航失败。

**English**

- Dates, period and metric are preserved in the page link across management tabs. Browser navigation restores the selection without duplicate paired fetches.
- Rejects unknown/repeated selectors, invalid dates and oversized intervals. Member search stays local; emails are never added to shareable filters.
- A failed link update is reported without blocking the current data view. Draft custom dates apply only after confirmation.
- Validation: 48 filter/statistics/component/bilingual tests and targeted ESLint passed, including linked initial state, history restoration, duplicate-query prevention, search privacy and failed navigation.

## 版本 11：可带走的检测报告 / Portable diagnostic reports

- 手动导出当前会话最多八条检测的 JSON/CSV；保留完成、失败、取消，取消/网络失败不伪称模型不可用。
- 显式字段白名单只含账号名称、模型、时间、指标和小题检查；不导出原始错误、正文、提示词或凭据。附透明限制说明。
- CSV 防公式注入；下载 DOM 与 Blob URL 自动释放，空记录/进行中禁用，下载失败可重试而不丢记录。
- 验证：32 项流、报告隐私/转义/清理、组件及双语测试通过，针对性 ESLint 与 vue-tsc -b 通过；无真实检测。

**English**

- Explicit JSON/CSV export of up to eight current-session completed, failed or cancelled runs. Cancelled/network-failed probes leave availability unknown.
- A strict field allowlist includes account display names, models, timestamps, metrics and fixture checks, never raw errors, bodies, prompts or credentials. Reports include limitations.
- Formula-safe CSV, download-element/object-URL cleanup, empty/running guards and retryable download errors without losing records.
- Validation: 32 stream/report privacy/escaping/cleanup/component/bilingual tests, targeted ESLint and vue-tsc -b passed. No real diagnostic was run.

## 版本 12：可访问的每日对账 / Accessible daily reconciliation

- 趋势图新增同源每日明细，可键盘展开/滚动，表头与日期行有语义标记；不只依赖 Canvas 看数据。
- 单独导出完整时段的每日汇总 CSV，不受成员榜前 200 名限制，也不含成员凭据/正文。
- 工作台按钮、链接、折叠和滚动区域统一可见焦点；提高浅色空态文字对比度，保留暗色与减少动态偏好。
- 验证：52 项统计/导出/筛选/组件/双语测试通过，针对性 ESLint 与 vue-tsc -b 通过。浏览器像素截图仍受执行环境限制，未冒称视觉实测。

**English**

- Added a same-data daily table beside the trend chart, with keyboard disclosure/scrolling and semantic row/column headers. Data is no longer accessible only through Canvas.
- Separate full-period daily aggregate CSV is independent of the top-200 member ranking and excludes credentials or request bodies.
- Consistent visible keyboard focus across workspace controls and improved light-mode empty-state contrast, retaining dark mode and reduced-motion support.
- Validation: 52 statistics/export/filter/component/bilingual tests, targeted ESLint and vue-tsc -b passed. Browser pixel screenshots remain environment-blocked and are not claimed as completed visual testing.

## 版本 13：到期、部分结算与诊断边界 / Expiry, partial settlement and diagnostic bounds

- 独立审查驱动：临时到期策略与客户端断开分离，在 HTTP、SSE、HTTP→上游 WS 脱离取消时仍保留截止时间，正常成员行为不变；结算上下文仍可完成计费。
- 仅临时到期时透传已观测的 WS 部分用量，复用现有账单流程，不伪造上游最终 Token；拒绝 drop/sample 用量丢弃策略。
- 诊断 429 不再修改生产限流/健康状态；在解析前限制上游响应总字节 64 KiB，覆盖无换行帧、忽略事件及巨大错误正文，原正常检测不变。
- 修复本地验证码 mock 被代理接管的测试隔离；新增中英使用/部署/阶段验证说明。
- 验证：服务联合到期/旧行为/全部诊断回归通过（1.068s）；到期用例重复 10 次通过（7.099s）；新增配置策略后 middleware 通过（0.032s）；Aliyun 四例通过。最终全量与静态扫描仍继续，不将专项结果等同全量通过。

**English**

- Independent review preserved the temporary policy deadline through HTTP/SSE/upstream-WS client-cancellation detachment, without changing ordinary-member behavior. Billing contexts remain able to settle after expiry.
- Expiry-only error paths propagate already observed partial WS usage through existing billing, never invent final tokens. Temporary billable requests reject drop/sample usage-loss policies.
- Diagnostic 429 responses no longer mutate production rate-limit/health state. A 64 KiB pre-parser body cap covers newline-free frames, ignored events and oversized provider errors; normal account tests remain unchanged.
- Isolated local CAPTCHA mock endpoints from inherited proxy behavior; added bilingual user/deployment/interim validation guides.
- Validation: combined service expiry/legacy/all-diagnostic regression passed (1.068s), expiry cases passed ten repeats (7.099s), final policy middleware tests passed (0.032s), and all four CAPTCHA tests passed. Final full-suite/static analysis is still running; focused passes are not a full-pass claim.
