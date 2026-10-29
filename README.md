# Sub2API 拼车管理版

**一个面向小团队与多人合用场景的管理员工作台。** 以蓝白卡片、清楚的计费语义和真实数据为中心，而不是在原版旁边叠一套独立账本。

[中文使用指南](docs/carpool/USER_GUIDE.md) · [English](#english) · [构建部署 / Build](docs/carpool/DEPLOYMENT.md) · [验证与限制 / Validation](docs/carpool/VALIDATION.md) · [逐版记录 / Iterations](docs/carpool/ITERATIONS.md) · [可选实库验证 / PostgreSQL](docs/carpool/POSTGRES_VALIDATION.md)

基于 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) **v0.2.19**，独立定制；不代表上游官方发行。原 **LGPL-3.0** 许可证和作者署名保留。上游原文见 [English](README_UPSTREAM.md) / [中文](README_CN.md)。

## 能做什么

| 管理场景 | 已实现 | 重要边界 |
|---|---|---|
| 看大家用了多少 | 真实日趋势、消费/Token/请求排行、按时段筛选、每日汇总与 CSV | 榜单最多 200 人；总览汇总不受此限制 |
| 管理订阅与按量成员 | 复用分组配置、分配订阅、成员查询、带审计说明的幂等余额调整 | 余额 ≠ 订阅额度；没有新增第三方支付 |
| 访客或短期试用 | 临时账号到期＋累计消费限额、延期/启停、后端约束 | 后结算软限额，在途请求可能超额 |
| 及时处理成员问题 | 可调低余额提醒、未来七天订阅到期提醒、直达管理入口 | 每来源检查最多 100 条，不是全员完整审计 |
| 比较模型表现 | 显式确认后手动检测可用性、首字/总延迟、真实 Token 吞吐 | 固定 JSON 小题检查不是综合能力排行榜 |
| 保存检查结果 | 会话检测 JSON/CSV，含完成/失败/取消；每日对账表可键盘阅读 | 不导出提示词、响应正文或密钥；账号/成员信息仍需保密 |

入口：**管理员 → 拼车管理**。普通成员继续使用自己的控制台，不能读取跨成员统计。

## 先读这几条

- **仅交付源码，没有部署到你的服务器。** 上游预构建镜像不含本项目定制，应从本源码构建前后端。
- 临时预算是累计实际用户扣费的**软限制**，不是预扣硬封顶；中断请求仅结算已观察用量，无法保证与上游最终账单完全对齐。临时付费请求要求用量队列溢出策略 `sync`。
- 真实模型检测会消耗上游额度，每次需手动确认；默认无定时检测。失败/取消仍可能产生费用。
- 不内置第三方 OAuth 客户端秘密、数据库默认口令或生产 API Key。配置要求见 [项目说明](README_CARPOOL.md)。
- 默认 CI 仅执行审核过的内存/localhost 后端回归与静态检查/编译。继承全套测试曾触发外部辅助请求并被终止，**没有声称全后端测试通过**。真实数据库迁移/并发和浏览器像素验证仍有环境限制。

## 开发验证

```bash
# 安装依赖与构建说明请先读 docs/carpool/DEPLOYMENT.md
make test-carpool-frontend
make test-carpool-backend
```

前端完整回归：**387 文件 / 3143 测试通过**。后端精选回归：**6 包、45 顶层 / 117 含子项通过**。测试数量不替代安全审查或生产验收；最新状态、未运行项目与具体命令见 [验证记录](docs/carpool/VALIDATION.md)。

---

## English

An independent **administrator carpool workspace** based on [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) v0.2.19, with a cohesive blue-white interface and real existing billing data. This is not an official upstream release. Original attribution and LGPL-3.0 are retained; [upstream documentation](README_UPSTREAM.md) remains available.

**Implemented:** real usage trends and metric-selectable top-200 rankings; subscription configuration/assignment and audited idempotent prepaid-balance operations; expiring temporary members with cumulative budgets; limited-scope low-balance/subscription-expiry attention; explicitly initiated model diagnostics; private session JSON/CSV reports; keyboard-readable daily figures and exports.

The administrator entry is **Carpool management**. Ordinary users keep their own console. Prepaid balances, subscription quotas and temporary budgets remain distinct. There is no new payment processor or automatic production deployment.

Temporary budgets are **post-request soft caps**, not reserved hard ceilings. Concurrent in-flight work can overshoot; interrupted work settles observed usage only and cannot guarantee final provider-invoice reconciliation. Temporary billable requests require the `sync` usage-overflow policy. Model probes can incur upstream cost even if cancelled; they are manual, never scheduled by default. The transparent JSON fixture is not a general model-intelligence ranking.

No third-party OAuth secrets, default database password or production API keys are bundled. Build this source rather than using an upstream prebuilt image. Default CI runs reviewed in-memory/localhost backend checks, compilation and static analysis; the inherited full suite was stopped after a provider-helper request and is **not reported as passed**.

**Evidence:** full frontend regression passed 387 files / 3143 tests; curated backend checks passed 6 packages, 45 top-level / 117 including subtests. Real database migration/concurrency and browser-pixel checks remain environment-limited. Read the bilingual [user guide](docs/carpool/USER_GUIDE.md), [build/deployment guide](docs/carpool/DEPLOYMENT.md), [validation record](docs/carpool/VALIDATION.md) and [iteration log](docs/carpool/ITERATIONS.md) before operating the system.
