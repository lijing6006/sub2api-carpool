# 验证状态 / Validation status

## 中文

记录日期：2026-10-28 UTC。这是本地源码验证，不是生产部署批准；本地通过不代表远端 GitHub CI 已通过。

### 最终代码已通过

| 检查 | 结果与覆盖 |
|---|---|
| 前端 ESLint | `pnpm --dir frontend run lint:check` 全仓通过 |
| 前端类型与生产构建 | `pnpm --dir frontend run build` 通过，含 i18n、`vue-tsc -b`、Vite；保留既有大 chunk / Browserslist 数据过旧提示 |
| 前端完整回归 | `pnpm --dir frontend exec vitest run`：**387 文件 / 3143 测试通过** |
| 拼车专项前端入口 | `make test-carpool-frontend`：**13 文件 / 135 测试通过** |
| 审核过的后端回归 | `make test-carpool-backend` 对应选择：**6 包、45 顶层 / 117 含子项通过**，仅内存/localhost mock |
| 后端全仓静态检查 | `golangci-lint run --timeout=30m`，v2.14.0：**0 issues** |
| 嵌入前端的后端构建 | backend 目录下 `CGO_ENABLED=0 go build -p 1 -tags embed -trimpath -o <local-output> ./cmd/server`：退出码 **0**；未启动生成的服务 |
| 部署静态检查 | 四个部署静态脚本与 `bash -n deploy/apple-container.sh` 通过；不等于部署或启动容器 |
| 文档与源树 | `git diff --check`、自定义 Markdown 相对链接检查通过；源码包另做完整性、排除项与凭据形态扫描；扫描不是完整安全认证 |

可选 PostgreSQL 夹具另经 `go test -c -tags=carpoolpg` 编译和带标签 repository golangci-lint（0 issues）检查；未执行数据库测试。缺少显式 opt-in 的 Make 入口按预期退出 2。

### 安全与行为覆盖

- 实际管理员路由、普通成员不可读取跨成员数据、Simple Mode 限制；真实统计、时段校验、浏览器导航恢复及 CSV 公式防护。
- 余额稳定幂等键、未知结果重试、订阅/余额语义；临时用户创建/更新、过期 JWT/刷新拒绝、数据库重读及累计消费幂等结算。
- 独立审查修复了脱离客户端取消时丢失临时到期的问题：HTTP/SSE/HTTP→上游 WS 保留独立截止时间，正常用户行为不变，结算不被到期中断。到期用例另重复 **10 次通过**。
- 到期 WS 请求保留已观测部分用量，不编造最终 Token；临时付费请求拒绝 `drop`/`sample` 丢弃用量策略。
- 诊断 429 不修改生产账号状态；解析前字节上限覆盖无换行帧、忽略事件及巨大错误正文。取消、重复操作、旧响应、缺失指标、质量小题与可用性分离均有回归。
- 导出字段白名单、下载资源释放、中英 key 完整性；普通用户 DTO/API 合约兼容已修复并回归。

### 明确未通过或未运行

1. **完整、不受限 Go 套件：已停止，未通过。** 继承 TokenRefresh 夹具的硬编码 dummy token 曾触发 Google 隐私辅助 HTTPS 请求，审查终止执行，进程已结束；另两个继承参数矩阵用例依赖外部 DNS 而失败。已隔离这些夹具，未绕过限制重跑全套。默认 CI 改为已审核内存/localhost 回归＋编译/静态检查；**精选通过不是全套通过**。不要向单元测试注入生产凭据，剩余供应商辅助逻辑须先审查隔离。
2. **真实 PostgreSQL 迁移、并发、恢复和负载：未运行。** 已成功构建官方 PostgreSQL 18.6 并完成 initdb，但首次仅 Unix socket 启动被系统拒绝（Operation not permitted）；已停止该路径并清理临时目录，未改用 TCP 或提权。可选真实库夹具仅编译/静态检查，尚未执行。详见 [实库验证说明](POSTGRES_VALIDATION.md)。SQL mock 不替代实库，上线前须在允许的隔离实例验证迁移 249。
3. **浏览器像素、移动设备与实际截图：受阻，未完成。** 容器 Chromium 受 sandbox/IPC 限制，支持的远程浏览器不能访问容器 loopback。组件 DOM/键盘测试不是实机视觉验收；没有把原型图冒充截图。
4. **macOS 容器生命周期、Docker Compose 渲染：未运行。** Linux 执行器没有 Docker，静态检查不替代运行时流程。
5. **真实付费模型检测与生产部署：没有执行。** 新功能仅 mock 测试；已披露的旧隐私辅助请求不是付费推理，也不能隐瞒为“没有任何外网请求”。
6. **远端发布及该提交 CI：由发布流程独立核实。** 本地提交/构建不能证明远端有代码、CI 通过或已部署。

### 解释结果的边界

临时预算是后结算**软限制**，在途/待结算并发可能超额；中断请求缺少最终上游用量时可能低估，不能保证提供商账单完整对账。`sync` 溢出回退不是崩溃恢复账本。固定 JSON 小题是透明、非权威的协议/指令检查，不是通用质量评级。

公开历史使用安全覆盖移除继承口令、第三方 OAuth 秘密和不需要的发布自动化，因此公开 SHA 可不同于本地提交。不会公开含旧凭据的原始 Git bundle。源码包只含当前已提交安全树，不带 `.git`、依赖、真实 `.env` 或构建产物。

## English

Recorded on 2026-10-28 UTC. These are local source checks, **not production approval or an unverified claim that remote GitHub CI passed**.

### Final code: passed

- Whole-frontend ESLint; i18n, Vue TypeScript and Vite build. Inherited large-chunk/stale-Browserslist warnings remain.
- Full Vitest: **387 files / 3143 tests**. Dedicated carpool target: **13 files / 135 tests**.
- Reviewed in-memory/localhost backend selection: **6 packages, 45 top-level / 117 including subtests**. `make test-carpool-backend` documents the selection.
- Whole-backend golangci-lint v2.14.0: **0 issues**.
- `CGO_ENABLED=0 go build -p 1 -tags embed -trimpath -o <local-output> ./cmd/server`: **exit 0**, including the built frontend. The resulting server was not started.
- Four deployment static checks, Apple-script shell syntax, whitespace and custom Markdown relative links passed. Archive integrity/exclusion/credential-pattern checks are separate; scans are not complete security certification.

Coverage includes actual admin routing, ordinary-user/API compatibility, real analytics and restored navigation, balance idempotency/uncertain retries, temporary authorization and cumulative settlement, expiry retained through HTTP/SSE/upstream-WS detachment, and billing independent of expiry. Expiry cases also passed **ten repetitions**. Observed partial WS usage is preserved without invented final tokens; temporary billable requests reject lossy `drop`/`sample` policies. Diagnostics cover non-mutating 429, pre-parser bounds, cancellation/stale responses, missing metrics and transparent fixture checks. Export allowlists, CSV escaping, resource cleanup and bilingual keys are covered.

The optional PostgreSQL fixture additionally passed compile-only `go test -c -tags=carpoolpg` and tagged repository lint (0 issues), not database execution. Missing explicit Make opt-in correctly exits 2.

### Stopped, blocked or not run

1. **Unrestricted full Go suite: stopped, not passed.** An inherited dummy-token TokenRefresh fixture attempted a live Google privacy-helper HTTPS call; review terminated execution. Two inherited matrix cases depended on external DNS. Identified fixtures were isolated; the full suite was not retried via a workaround. Default CI uses reviewed isolated regression plus compilation/static analysis. A curated pass is not a full-suite pass. Never inject production credentials; review/isolate remaining broad provider tests first.
2. **Real PostgreSQL migration/concurrency/recovery/load:** not run. Official PostgreSQL18.6 built and initdb succeeded, but first Unix-socket-only startup was denied with Operation not permitted. The path was stopped and disposable directories removed, without TCP/elevation bypass. The optional real-DB fixture was compile/static-checked only; see [PostgreSQL validation](POSTGRES_VALIDATION.md). SQL mocks do not replace isolated acceptance of migration 249.
3. **Browser pixels, mobile devices and actual screenshots:** blocked by Chromium sandbox/IPC and remote-browser loopback reachability. DOM/keyboard tests are not visual acceptance. The prototype was never substituted for a screenshot.
4. **macOS container lifecycle / Docker Compose rendering:** not run in this Linux executor without Docker.
5. **Paid model probes and production deployment:** not performed. New-feature tests use mocks. The disclosed inherited privacy-helper attempt must not be obscured by a claim of zero outbound requests.
6. **Remote publication and exact-commit CI:** require separate verification, never inferred from local commits/builds.

Temporary budgets are post-settlement **soft caps**; in-flight/unsettled work may overshoot. Missing final provider usage can undercount interrupted requests; observed usage is not full invoice reconciliation. Synchronous overflow fallback is not crash-durable accounting. The JSON fixture is a transparent, non-authoritative protocol/instruction check, not a general intelligence ranking.

Public history uses reviewed safety overlays to remove inherited passwords/OAuth secrets and unnecessary publishing automation, so public SHAs can differ. No unsafe raw-history Git bundle is published. Source archives contain only the committed safe tree, without `.git`, dependencies, real `.env` or build output.
