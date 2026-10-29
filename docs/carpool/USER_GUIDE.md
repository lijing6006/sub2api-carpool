# 拼车管理员使用说明 / Carpool administrator guide

## 中文

### 第一次使用
1. 登录管理员账号，在标准计费模式下进入 **拼车管理**。普通成员仍只使用自己的控制台，不能访问跨成员数据。
2. 先在 **成员与订阅** 打开订阅组配置，设置已有分组的计费方式、模型与额度，再给目标成员分配订阅。分配前核对分组、有效期和已有订阅，避免误操作。
3. 按量成员使用原有预付余额流程；余额调整需要金额与审计说明。网络中断后先查询余额/记录，不要换金额或说明盲目重试。
4. 在 **总览** 查看真实请求数据；没有请求时图表为空，不展示演示消费。总消费来自完整时段趋势，成员榜最多 200 人，搜索只过滤已返回榜单。CSV 导出包含成员信息，请按敏感管理数据保管。

### 余额、订阅、临时限额的区别

| 项目 | 含义 | 注意 |
|---|---|---|
| 预付余额 | 按量计费时的用户资金余额 | 不代表订阅剩余额度，不是新支付系统 |
| 订阅额度 | 已分配订阅组的日/周/月限制 | 原有 Key 分组选路与计费规则保持不变 |
| 临时账号累计限额 | 所有 Key、平台、余额及订阅路径累计的实际用户扣费上限 | 请求后结算的软限制；调整上限不清零已消费，充值也不清零 |

### 临时成员
- 仅能创建新的普通临时用户；不能把既有用户改成临时用户，也不能提升为管理员。
- 同时填写未来一年内的到期时间与正数美元限额；密码至少 12 字符。初始余额不能超过限额，仍需另行分配订阅或按原流程授权 Key。
- 不自动生成或发送 API Key。密码成功提交/取消后清除；请通过你自己的安全渠道交付临时凭据。
- 到期后禁止登录、刷新会话与新网关请求，向在途上游请求发出取消信号；已产生的费用仍需结算。
- 额度是**后结算软限额**：并发、在途和待结算请求可能超出。降低并发和设置较小单次请求上限可以降低风险，但不等于严格预扣硬封顶。
- 仅允许审核过的同步文本、向量及图片入口；WebSocket、后台任务、批处理、视频/音频、持久缓存和未知入口拒绝。

### 提醒中心
低余额提醒默认阈值 $5，可本地调整，排除具有有效订阅的成员。订阅提醒检查未来 7×24 小时。每路最多读取 100 条，排序和范围写在卡片下方；旧 active 记录可能占用范围。它是辅助检查，不是全员审计、自动扣款、自动续费或通知系统。

### 模型检测
- 明确选择已配置账号及文本模型，每次勾选费用确认后手动运行。系统不会定时或自动运行。
- 可用性、首字文本延迟、总耗时、真实上游输出 Token/吞吐分开显示。缺失指标显示未知，首字时间不是浏览器网络测速。
- 固定小题只检查 JSON 格式、加法与排序三个维度；分数不等于综合能力，不能把低延迟解释成高质量。
- 60 秒服务端截止，最多 4 KB 可见输出与 64 KiB 上游响应总字节；支持的协议发送小输出上限，但 Codex OAuth 不支持该 Token 参数。失败或取消仍可能产生费用。
- 本会话最多记录八次完成/失败/取消结果，可手动导出 JSON/CSV；报告不含提示词、响应正文或密钥，但账号名称属于管理信息。离开页面后不做持久化。

用量队列必须保留默认 `gateway.usage_record.overflow_policy: sync`；临时成员的付费请求在 `drop`/`sample` 下会被拒绝。同步溢出回退避免主动丢弃，不是崩溃恢复账本；中断请求只能结算已观察到的用量，上游未返回最终用量仍可能低估，不能保证与提供商账单完全对齐。

## English

### First use
1. Sign in as an administrator and open **Carpool management** in standard billing mode. Ordinary members retain their own console; cross-member data is administrator-only.
2. Configure existing subscription groups first, then assign the intended group and validity to each member. Check existing subscriptions before confirming.
3. Pay-as-you-go members use existing prepaid balances. Balance adjustments require an amount and audit note. After an uncertain network result, re-read records before retrying; never blindly change the amount/note to bypass duplicate protection.
4. Overview charts use real requests only. Totals come from the full selected period; ranking is limited to 200 members and search filters only those returned rows. Treat exported member CSV files as confidential administrative data.

### Separate billing concepts

Prepaid balance is user credit, not remaining subscription quota. Subscription groups retain their existing daily/weekly/monthly limits and API-key group routing. A temporary-member budget tracks cumulative actual user charges across keys, platforms, prepaid and subscription paths. Top-ups and cap edits do not reset prior spending.

### Temporary members

Create new ordinary temporary users with both a future expiry within one year and a positive USD budget. Passwords require at least 12 characters; initial prepaid balance cannot exceed the budget. Existing regular users cannot be converted and temporary members cannot become administrators. No production API key is automatically generated or delivered.

Expiry rejects login, refresh and new gateway access and cancels in-flight upstream work; already incurred usage still settles. Budgets are **post-request soft caps**: concurrent, in-flight or unsettled requests can overshoot. Lower concurrency/request limits reduce exposure but do not provide a reserved hard ceiling.

Only audited synchronous text, embedding and image routes are supported. WebSocket, background/async jobs, batch, video/audio, persistent caching and unknown routes fail closed.

### Attention and diagnostics

Low-balance reminders use a locally adjustable $5 default and exclude members with valid subscriptions. Expiry reminders cover the next 7×24 hours. Each source inspects at most 100 sorted records with explicit limits; this is not an exhaustive audit or an automated renewal/billing/notification system.

Model probes require a configured authorized account, supported text model and explicit cost acknowledgement on every run. There are no scheduled probes. Availability, first-text latency, total duration and provider-reported token throughput are distinct. Missing metadata remains unknown. Three transparent JSON/arithmetic/sorting checks are not a general model benchmark.

Diagnostics have a 60-second server deadline, 4 KB visible-output limit and 64 KiB total upstream-body limit. Supported protocols request a small output-token budget; Codex OAuth does not accept that parameter. Failed/cancelled work can still incur cost. Up to eight session outcomes can be manually exported without prompts, response bodies or keys; account names remain confidential. Session history is not persisted after navigation.

Keep `gateway.usage_record.overflow_policy: sync` (the default). Temporary billable requests are rejected under `drop`/`sample`. Synchronous overflow fallback prevents intentional dropping; it is not a crash-recovery ledger. Interrupted requests settle observed usage only; missing final provider usage can undercount and cannot guarantee reconciliation with the provider invoice.
