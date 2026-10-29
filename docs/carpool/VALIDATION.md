# 验证状态 / Validation status

## 中文

这是**阶段源码交付**的验证记录，不是生产部署批准。最终全量回归仍在进行；请以随后更新的记录和实际 CI 结果为准。

### 已完成
- 管理员路由限制、真实用量/排行、日期筛选、余额幂等操作、订阅与临时账号组件回归。
- 前端全仓 ESLint、Vue TypeScript 类型检查及 Vite 构建通过（构建有既有大 chunk 警告）。新增诊断报告 32 项专项测试、每日明细/筛选 52 项专项测试通过。
- 第一次前端全套回归 381 文件 / 3076 测试通过；追加功能后的最终全套正在运行，不能把早期数字当成最终通过。
- 临时用户授权/计费与诊断最初联合回归 4 个 Go 包、97 顶层 / 121 含子项通过。普通用户 DTO 合约新增字段兼容问题已修复并通过整个 DTO 包及 TestAPIContracts。
- 独立审查发现并修复：网关脱离客户端取消时丢失临时到期、上游 WS 错误路径丢弃已观测部分用量、诊断 429 修改生产账号状态、未解析响应字节超限。修复后的服务回归通过；到期用例重复 10 次通过。
- 临时付费请求拒绝主动丢用量的 drop/sample 队列策略，最终 middleware 定向回归通过。模拟 Aliyun 测试的 localhost 代理隔离问题已修复，4 项测试通过，不修改外网代理。
- 清除继承 OAuth 客户端秘密和数据库弱默认，3 个受影响后端包通过。源树秘密形态扫描、diff whitespace 检查通过；扫描不是完整安全认证。

### 尚未完成 / 环境限制
- 最终所有 Go 单元测试、golangci-lint 和新增功能后的完整前端回归：进行中。
- 真 PostgreSQL 迁移、事务并发、恢复与负载测试：未运行，本环境无 PostgreSQL/Docker。SQL mock 不替代真实数据库。
- 浏览器像素/移动设备截图：未取得。容器 Chromium 受 sandbox/IPC 限制，支持的远程浏览器不能访问该容器 loopback。未冒用原型图作为实际截图。
- 真实付费模型检测：没有运行；仅内存 mock。没有生产部署、没有生成生产凭据。
- 远端源码发布和该提交 CI：由发布流程核实，不能由本地提交推断。

## English

This is an **interim source handoff**, not production deployment approval. Final whole-project regression remains in progress; use subsequent updates and actual CI results.

Completed checks include administrator routing, real usage/rankings, date filters, balance idempotency, subscriptions and temporary-member components. Whole-frontend ESLint, Vue type checking and Vite build passed, with an inherited large-chunk warning. Focused diagnostic-report checks passed 32 tests; daily-data/filter checks passed 52 tests. An earlier full frontend run passed 381 files / 3076 tests; the newer final run is still pending and must not be represented by that earlier count.

Initial focused backend regression passed 4 packages, 97 top-level / 121 including subtests. Ordinary-user DTO compatibility and server API contracts were repaired and re-tested. Independent review found and fixed expiry lost during context detachment, discarded observed partial usage in WS-backed error paths, diagnostic 429 production-state writes, and unbounded pre-parser diagnostic bytes. Service regression passed and expiry cases passed ten repeated runs. Final temporary middleware tests and four local mocked CAPTCHA tests passed. Missing OAuth configuration tests and affected configuration packages passed after removing bundled secrets/weak defaults.

Pending: final all-package Go tests, golangci-lint, full frontend regression after all additions, remote publication verification and exact-commit CI. Not run: real PostgreSQL migration/concurrency/recovery/load tests (no database/Docker here), paid model calls or production deployment. Browser pixel screenshots are blocked by container sandbox/IPC and remote-browser loopback reachability; the prototype is not an actual screenshot. Pattern scans are not a complete security certification.
