# 拼车版迭代记录 / Carpool iteration log

**中文说明：** 每个版本都是独立提交的实际功能改进，附验证结果。开发期间未连接用户生产部署、未调用付费模型；旧测试的外部隐私辅助请求已在版本 15 披露。上游基线为 v0.2.19；后续尚未完成的项目不会写成已通过。

Upstream baseline: `v0.2.19`, `dece26153621959ccd7635814f4b2d08304e681a`.
Each version below is a substantive, separately committed increment. No user production deployment or paid model was called during development; version 15 discloses an inherited test's external privacy-helper attempt.

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

## 版本 14：回归入口与源码构建检查 / Regression entry points and source-build checks

- 把拼车组件、路由、指标、检测及余额幂等测试加入既有 CI 关键测试入口，新增 `make test-carpool-frontend`，避免功能只在开发者本地测到。
- 安全清理后发现原镜像资源检查仍引用已删除的发布文件；改为验证实际根目录与 deploy Dockerfile 的资源拷贝，不恢复发布自动化。
- 验证：新 Make 目标 13 文件 / 135 测试全部通过；四个部署静态校验与 Apple 脚本语法通过。macOS 容器生命周期和 Docker Compose 渲染测试未在当前 Linux/无 Docker 环境运行，未伪称通过。

**English**

- Added carpool component/routing/metrics/diagnostic/balance-idempotency tests to the existing CI critical-test entry point and introduced `make test-carpool-frontend`.
- Found and repaired a resource check that still referenced removed release files. It now validates resources in the actual root/deploy Dockerfiles without restoring publishing automation.
- Validation: the new Make target passed 13 files / 135 tests. Four deployment static checks and Apple-script syntax passed. macOS container lifecycle and Docker Compose rendering were not run in this Linux executor without Docker and are not claimed as passed.

## 版本 15：隔离测试副作用 / Isolate test side effects

- 全 Go 套件中断暴露旧测试问题：TokenRefresh 的 dummy token 夹具会触发真实隐私辅助 HTTPS；参数矩阵的真实域名造成 DNS 依赖。进程已结束，没有绕过拒绝继续。
- 缓存失效测试显式使用已配置隐私的夹具并断言无额外写入；参数矩阵改成只做本地校验的 IP 字面量，不改生产 SSRF 规则。
- 新增 `make test-carpool-backend` 显式选择已审查的内存/localhost 用例，默认 CI 改为该回归＋编译，不间接重跑未隔离全套；部署说明同步纠正。
- 验证：精选 6 包，45 个顶层 / 117 含子项全部通过；完整 Go 套件明确标记未通过/已停止，未用“排除后通过”冒充全套通过。

**English**

- A stopped full Go run exposed inherited test side effects: a dummy-token TokenRefresh fixture attempted a live privacy-helper HTTPS call, while a validation matrix depended on external DNS. The process ended; the rejection was not bypassed.
- The cache-invalidation test now declares preconfigured privacy and asserts no extra write. The matrix uses locally validated IP literals without changing production SSRF rules.
- Added an explicit reviewed in-memory/localhost `make test-carpool-backend` selection. Default CI uses it plus compilation, not an indirect rerun of the unisolated suite; deployment instructions match.
- Validation: all 6 packages, 45 top-level / 117 including subtests passed. The full Go suite remains explicitly stopped/not passed; a curated pass is never represented as a full-suite pass.

## 版本 16：交付入口与最终质量核验 / Delivery entry point and final quality checks

- 主 README 改为中文优先、完整英文对应的拼车项目首页，给出实际功能、管理员入口、计费边界和构建/使用链接；原上游 README 原样保留为 `README_UPSTREAM.md`，摘要值核对一致。
- 部署说明明确从本源码升级、不要使用上游二进制自更新覆盖定制；依赖安装示例关闭生命周期脚本。
- 修复静态检查发现的诊断上下文无用赋值，不改变已设置的请求截止时间；对最终代码重新做完整前端、精选后端、全仓静态检查与嵌入构建。
- 验证：前端 ESLint / Vue 类型 / Vite 构建通过，387 文件 / 3143 测试通过；精选后端 6 包 / 117 含子项通过；golangci-lint v2.14.0 **0 issues**；嵌入前端的 Go 构建退出 0。自定义 Markdown 相对链接、diff whitespace 通过。
- 最终验证文档逐项区分通过、停止和未运行：完整 Go 套件未通过，真实数据库/移动设备/浏览器像素和远端 CI 未冒称验证。公开历史按安全覆盖重建，不包含旧凭据历史。

**English**

- Replaced the root README with a Chinese-first, fully bilingual project entry point, real feature boundaries, admin navigation and guide links. Preserved the original upstream README byte-for-byte as `README_UPSTREAM.md`, with matching SHA-256.
- Documented source-based upgrades rather than overwriting the customization with an upstream self-update; installation examples disable lifecycle scripts.
- Removed a diagnostic-context dead assignment found by static analysis without changing the request deadline. Re-ran whole-frontend checks, curated backend regression, whole-backend lint and the embedded build.
- Validation: frontend ESLint / Vue types / Vite passed; **387 files / 3143 tests** passed; curated backend **6 packages / 117 including subtests** passed; golangci-lint v2.14.0 reported **0 issues**; the frontend-embedded Go build exited **0**. Custom Markdown links and whitespace checks passed.
- Final validation documentation distinguishes passed, stopped and untested work: unrestricted Go, real database/mobile/browser pixels and remote CI are not misrepresented. Public history is safety-sanitized and excludes old credentials.

## 版本 17：可复用的真实数据库验收夹具 / Reusable real-database acceptance fixture

- 新增独立 `carpoolpg` 标签，用现有迁移、用户和计费仓库验证升级兼容、约束、同键幂等、16 路并发、订阅/余额原子结算及失败回滚；不改生产计费实现。
- 连接只接受显式私有 Unix socket、固定测试用户/数据库和全新 schema，禁止 TCP/生产 DSN 回退，显式空密码防止读取个人凭据。Make 入口缺少 opt-in 时失败，默认 CI 不自动启用。
- 提供完整中英运行说明；PostgreSQL18.6 官方源码及 SHA-256 校验、非特权构建和 initdb 成功。但第一次 Unix socket 启动被环境拒绝，已确认服务停止并清理自建临时数据目录，保留日志；不改 TCP、不提权绕过。
- 验证：最终夹具 `go test -c -tags=carpoolpg` **仅编译通过**；带标签 repository golangci-lint **0 issues**；缺少 opt-in 的 Make 防护按预期退出 2；链接与 whitespace 检查通过。**真实数据库用例没有执行，不能记为通过。** V16 已验证的生产代码与前端未改变。

**English**

- Added a separate `carpoolpg` fixture exercising existing migration/user/billing repositories for additive upgrades, constraints, idempotency, sixteen-way races, subscription/balance atomicity and rollback; no production billing implementation changed.
- Accepts only an explicit private Unix socket, fixed fixture identity/database and fresh schema. No TCP/production-DSN fallback; an explicit empty password prevents personal credential-file inheritance. Missing Make opt-in fails; default CI does not enable it.
- Added bilingual instructions. Official PostgreSQL18.6 checksum, unprivileged build and initdb succeeded, but first Unix-socket startup was denied. Server shutdown was verified and newly created data/socket directories cleaned, with logs preserved; no TCP/elevation bypass.
- Validation: final tagged fixture **compiled only** with `go test -c`; tagged repository golangci-lint reported **0 issues**; missing-opt-in guard exited 2 as expected; links/whitespace passed. **Real database tests were never executed and are not passed.** Production/frontend code validated in V16 is unchanged.

## 版本 18：修复国际化依赖安全公告 / Fix the internationalization advisory

- 根据维护者[安全公告 GHSA-83rm-6c8r-g728](https://github.com/intlify/vue-i18n/security/advisories/GHSA-83rm-6c8r-g728)，不再维护的 v9 没有补丁；将 `vue-i18n` 与直接使用的 `@intlify/message-compiler` 精确固定到已修复的 `11.4.14`，锁文件只更新该依赖家族，不增加审计豁免。
- 修复版要求 Node >=22，因此 manifest 明确最低版本，两个既有前端/安全验证任务使用 Node24，与现有容器构建/部署说明一致；工作流权限与部署行为不变。
- 新增真实 runtime/JIT 的无脚本 srcdoc 属性中和回归，以及中英文切换、命名插值和复数验证；把安全/文案编译/订阅卡片回归接入既有 CI 关键入口。
- 首次全套发现订阅卡片 3 个旧断言依赖测试环境返回未翻译 key；v11 JIT 已能编译夹具，改为验证夹具实际文案，不改生产组件、不放宽断言。修复后 **388 文件 / 3147 测试全部通过**；专项 **11 文件 / 62 测试通过**，全仓 ESLint、`vue-tsc --noEmit`、包含类型检查的 Vite 构建通过。
- 生产依赖审计中目标公告已消失，既有审计门禁通过，例外清单逐字未改。**不是零漏洞**：仍有既有 xlsx 的 2 项 high（原有有效豁免），以及 13 项 moderate、2 项 low。本次不改变这些风险处置，也没有运行后端完整/真实供应商测试或部署。

**English**

- The maintainer's [GHSA-83rm-6c8r-g728 advisory](https://github.com/intlify/vue-i18n/security/advisories/GHSA-83rm-6c8r-g728) provides no v9 patch. Pinned Vue I18n and the directly used message compiler to fixed `11.4.14`; only the Intlify dependency family changed in the lockfile. No audit exception was added.
- The patched release requires Node >=22. The manifest declares that floor, and both existing frontend/security jobs use Node24, matching existing container/deployment guidance. Workflow permissions and deployment behavior are unchanged.
- Added real runtime/JIT inert-srcdoc neutralization and zh/en interpolation/pluralization regression. Critical CI now includes these, locale compilation and subscription-card checks.
- The first full run exposed three old assertions expecting untranslated keys; v11 JIT compiles the existing fixture, so assertions now verify its actual wording without changing the production component. Final **388 files / 3147 tests passed**; focused **11 files / 62 tests passed**, plus whole-frontend ESLint, explicit Vue type checking and the typed production build.
- The target advisory disappeared from the production audit and the existing audit gate passed with its exception file unchanged. This is **not vulnerability-free**: two existing xlsx highs remain under preexisting valid exceptions, plus thirteen moderate and two low findings. No unrelated exception changes, full backend/provider tests or deployment were performed.
