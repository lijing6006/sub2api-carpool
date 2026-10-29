# Sub2API 拼车管理版 / Carpool edition

基于 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) `v0.2.19` 的独立定制，保留原作者署名与 LGPL-3.0 许可证。本项目不隶属于上游，不提供代付或第三方支付处理。

## 中文

管理员菜单 **拼车管理** 集中提供：
- **用量总览**：真实消费、Token、请求趋势与最多 200 名成员排行，按时段和指标筛选、安全 CSV 导出。
- **成员与订阅**：复用订阅组配置/分配、成员查询和带审计说明的幂等余额调整；余额不等于订阅额度。
- **临时账号**：到期时间＋累计实际消费软限额，服务端校验，修改额度不清零历史消费。
- **模型检测**：仅管理员明确确认后手动运行；区分可用性、首字/总延迟、上游 Token 吞吐和固定小题检查，不宣称通用质量排名。

**重要边界**：临时账号额度按请求结算，在途并发可能超额，不是预扣硬封顶；真实检测会消耗已配置上游额度。没有定时检测、自动部署、真实支付集成或自动生成生产 API 密钥。

### 安全配置

- 数据库没有内置密码；必须配置独立强密码。不要提交 `.env` 或真实凭据。
- 不包含上游第三方 OAuth 客户端秘密。Antigravity 需要 `ANTIGRAVITY_OAUTH_CLIENT_SECRET`；Gemini CLI 需要 `GEMINI_CLI_OAUTH_CLIENT_SECRET` 或管理员配置的已授权自有 OAuth 客户端。未配置时相关流程明确报错，不会回退到共享秘密。
- 只保留只读 CI 验证；上游发布/镜像推送/CLA 写入自动化已移除。源码发布不触发生产部署。
- 所有跨成员数据仅管理员可见。不得公开使用量导出；普通用户继续使用自己的原有控制台。

[中英迭代记录 / Iteration log](docs/carpool/ITERATIONS.md) · [原版说明 / Upstream documentation](README_CN.md)

## English

An independent customization of [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) `v0.2.19`, retaining original attribution and LGPL-3.0. This is not an official upstream release or a payment processor.

The administrator-only **Carpool management** workspace combines real usage trends and a top-200 member ranking, subscription configuration/assignment, audited idempotent prepaid-balance adjustments, expiring temporary users, and explicitly initiated model diagnostics. Prepaid balance and subscription quota remain distinct.

Temporary-user budgets are cumulative **post-request soft caps**: concurrent or unsettled requests may overshoot. Model diagnostics can consume configured upstream credit. Availability, first-text/total latency, provider-reported throughput and the transparent fixed-fixture checks are separate; the fixture score is not a general model-quality ranking. There are no scheduled probes, automatic production deployments, new third-party payments or generated production API keys.

### Safe configuration

Database passwords must be explicitly configured and unique. Never commit real `.env` files or credentials. Third-party OAuth secrets are not bundled: set `ANTIGRAVITY_OAUTH_CLIENT_SECRET`, and `GEMINI_CLI_OAUTH_CLIENT_SECRET` or an authorized custom Gemini OAuth client. Missing configuration fails clearly rather than using a shared secret.

Only read-only validation CI remains. Upstream release/image-push/CLA-write automation was removed. Cross-member data is administrator-only; exports are confidential. Ordinary users retain their own existing console.
