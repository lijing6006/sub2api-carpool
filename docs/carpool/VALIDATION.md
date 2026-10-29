# 验证状态 / Validation status

## 中文

这是**阶段源码交付**的验证记录，不是生产部署批准。最终全量回归仍在进行；请以随后更新的记录和实际 CI 结果为准。

### 已完成
- 管理员路由限制、真实用量/排行、日期筛选、余额幂等操作、订阅与临时账号组件回归。
- 前端全仓 ESLint、Vue TypeScript 类型检查及 Vite 构建通过（构建有既有大 chunk 警告）。新增诊断报告 32 项专项测试、每日明细/筛选 52 项专项测试通过。
- 追加功能后的前端全套回归 **387 文件 / 3143 测试通过**；`make test-carpool-frontend` **13 文件 / 135 测试通过**。
- 临时用户授权/计费与诊断最初联合回归 4 个 Go 包、97 顶层 / 121 含子项通过。普通用户 DTO 合约新增字段兼容问题已修复并通过整个 DTO 包及 TestAPIContracts。
- 独立审查发现并修复：网关脱离客户端取消时丢失临时到期、上游 WS 错误路径丢弃已观测部分用量、诊断 429 修改生产账号状态、未解析响应字节超限。修复后的服务回归通过；到期用例重复 10 次通过。
- 临时付费请求拒绝主动丢用量的 drop/sample 队列策略，最终 middleware 定向回归通过。模拟 Aliyun 测试的 localhost 代理隔离问题已修复，4 项测试通过，不修改外网代理。
- 清除继承 OAuth 客户端秘密和数据库弱默认，3 个受影响后端包通过。源树秘密形态扫描、diff whitespace 检查通过；扫描不是完整安全认证。

### 尚未完成 / 环境限制
- 最终完整 Go 套件：**被终止，未通过**。旧 TokenRefresh 测试用硬编码 dummy token 触发 Google 隐私辅助 HTTPS 请求，审查停止执行；进程已结束。另两个旧参数矩阵用例依赖外部 DNS 而失败。已隔离这些夹具，未绕过限制重跑全套。改用已审核的内存/localhost 精选回归：**6 包、45 顶层 / 117 含子项全部通过**；覆盖新功能、普通 API 合约及已修复夹具。默认 CI 同步改成精选回归+编译，完整供应商/集成测试明确排除。
- golangci-lint 与最终后端构建：进行中。
- 真 PostgreSQL 迁移、事务并发、恢复与负载测试：未运行，本环境无 PostgreSQL/Docker。SQL mock 不替代真实数据库。
- 浏览器像素/移动设备截图：未取得。容器 Chromium 受 sandbox/IPC 限制，支持的远程浏览器不能访问该容器 loopback。未冒用原型图作为实际截图。
- 真实付费模型检测：没有运行；仅内存 mock。没有生产部署、没有生成生产凭据。
- 远端源码发布和该提交 CI：由发布流程核实，不能由本地提交推断。

## English

This is an **interim source handoff**, not production deployment approval. Final whole-project regression remains in progress; use subsequent updates and actual CI results.

Completed checks include administrator routing, real usage/rankings, date filters, balance idempotency, subscriptions and temporary-member components. Whole-frontend ESLint, Vue type checking and Vite build passed, with an inherited large-chunk warning. Focused diagnostic-report checks passed 32 tests; daily-data/filter checks passed 52 tests. The final full frontend run passed **387 files / 3143 tests**, and the dedicated Make target passed **13 files / 135 tests**.

Initial focused backend regression passed 4 packages, 97 top-level / 121 including subtests. Ordinary-user DTO compatibility and server API contracts were repaired and re-tested. Independent review found and fixed expiry lost during context detachment, discarded observed partial usage in WS-backed error paths, diagnostic 429 production-state writes, and unbounded pre-parser diagnostic bytes. Service regression passed and expiry cases passed ten repeated runs. Final temporary middleware tests and four local mocked CAPTCHA tests passed. Missing OAuth configuration tests and affected configuration packages passed after removing bundled secrets/weak defaults.

The full Go run was **stopped, not passed**: an inherited TokenRefresh fixture used a hardcoded dummy token in a Google privacy-helper HTTPS attempt, and review terminated execution. Two inherited validation-matrix cases also depended on external DNS. Those fixtures were isolated; the unrestricted suite was not retried through a workaround. A reviewed in-memory/localhost selection passed **6 packages, 45 top-level / 117 including subtests**, covering new features, existing API contracts and corrected fixtures. Automatic CI now uses this curated selection plus compilation; broad supplier/integration suites are explicitly excluded. Pending: golangci-lint, final backend build, remote publication verification and exact-commit CI. Not run: real PostgreSQL migration/concurrency/recovery/load tests (no database/Docker here), paid model calls or production deployment. Browser pixel screenshots are blocked by container sandbox/IPC and remote-browser loopback reachability; the prototype is not an actual screenshot. Pattern scans are not a complete security certification.
