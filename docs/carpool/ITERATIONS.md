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
