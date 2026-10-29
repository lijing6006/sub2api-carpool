# 构建与部署说明 / Build and deployment

## 中文

**本任务只交付源码，没有部署到生产，也没有执行真实付费模型调用。** 下列步骤是供仓库所有者审阅后在自己的环境执行的说明。不要直接把未验证迁移部署到现有生产数据。

### 本地构建

需要 Node.js 24、pnpm 9、Go 1.27.3（以仓库实际工具链要求为准）。新版本源码包含前端与后端变更，不能只替换前端静态文件。

```bash
cd frontend
pnpm install --frozen-lockfile --ignore-scripts
pnpm run lint:check
pnpm run build
cd ..
make test-carpool-backend
cd backend
CGO_ENABLED=0 go build -tags embed -trimpath -o bin/sub2api ./cmd/server
```

前端产物位于 `backend/internal/web/dist`。数据库和 Redis 应仅在受信任网络可达；初始化管理员时使用独立强密码。真实凭据只放在受限的本地配置或密钥管理系统，不提交 Git。

### 容器构建（未在本任务运行）

上游 `weishaw/sub2api:latest` **不含拼车定制**。从本源码构建自己的镜像：

```bash
docker build --build-arg GOPROXY=https://proxy.golang.org,direct \
  --build-arg GOSUMDB=sum.golang.org -t sub2api-carpool:local .
```

复用 `deploy/docker-compose.local.yml` 前，复制 `.env.example` 为仅本地使用的 `.env`，填入强随机 `POSTGRES_PASSWORD`、管理员设置和密钥；默认示例数据库口令已清空。把应用服务 `sub2api.image` 改为 `sub2api-carpool:local`（或使用自己的 Compose override），避免拉取上游镜像覆盖定制。先绑定 `127.0.0.1` 验证，再由你配置 TLS、反向代理与访问控制。本文不执行 `up` 或修改任何服务器。

### 测试隔离

默认使用 `make test-carpool-backend`。继承的上游全套测试包含外部供应商辅助调用，曾有 dummy-token 隐私请求被审查终止；本发行版已修复已识别夹具并将默认 CI 限为审核过的内存/localhost 回归。不要在未审查隔离前直接运行完整供应商/集成套件，更不要向单元测试注入生产凭据。

### 数据与升级

不要使用上游二进制自更新覆盖本定制版；升级应从本仓库审查后的源码构建，保留可验证的版本与备份。
- 先备份数据库与受限配置，在隔离测试实例验证。新增迁移 `backend/migrations/249_temporary_members.sql` 为用户增加可空到期/预算和累计消费字段及约束。
- 迁移由既有启动流程执行。官方 PostgreSQL 已在隔离工具目录编译，但执行器拒绝创建 Unix socket；真实迁移、回滚和并发压力验证**未运行**。可选独立夹具见 [实库验证](POSTGRES_VALIDATION.md)；SQL mock 不替代它们。
- 升级前后分别核对普通用户登录、管理员权限、余额扣费、订阅计费、重复账单幂等、临时到期取消以及累计软限额。
- 不应手工清零临时累计消费或删除字段来绕过策略。回退前先停流量并使用经验证的数据恢复方案，不盲目运行旧二进制。

### OAuth 与安全

Antigravity 需要部署者配置 `ANTIGRAVITY_OAUTH_CLIENT_SECRET`；Gemini CLI 需要 `GEMINI_CLI_OAUTH_CLIENT_SECRET` 或管理员配置的已授权自有 OAuth 客户端。本发行版不包含第三方共享 secret。相关配置缺失时 OAuth 流程会明确失败，其他已配置 API-key 用法不因此自动失效。

仅保留只读 CI 验证，上游发布/推镜像/CLA 写入自动化已移除。发布 GitHub 源码不代表部署许可。保留原 LGPL-3.0 许可证、作者署名及对应源码义务。

用量队列必须保留默认 `gateway.usage_record.overflow_policy: sync`；临时成员的付费请求在 `drop`/`sample` 下会被拒绝。同步溢出回退避免主动丢弃，不是崩溃恢复账本；中断请求只能结算已观察到的用量，上游未返回最终用量仍可能低估，不能保证与提供商账单完全对齐。

## English

**This task delivered source only: no production deployment and no paid model call was performed.** These instructions are for the repository owner's reviewed execution in their own environment.

Use Node.js 24, pnpm 9 and Go 1.27.3 as required by the checkout. Run the build commands above; frontend output is embedded from `backend/internal/web/dist`. Both frontend and backend must be upgraded together. Restrict PostgreSQL/Redis network access, use unique strong administrator/database passwords, and keep real credentials out of Git.

The upstream `weishaw/sub2api:latest` image does **not** contain this customization. Build this source with the shown Docker command. Before reusing `deploy/docker-compose.local.yml`, create a private local `.env`, supply required secrets and replace the `sub2api` service image with `sub2api-carpool:local` (or an owner-managed Compose override). Validate on loopback before separately configuring TLS, reverse proxy and access controls. No container startup or server modification was performed here.

Back up the database/configuration and validate in an isolated instance first. Migration `249_temporary_members.sql` adds nullable temporary expiry/budget, cumulative spending and constraints. Existing startup migration machinery applies it. Real PostgreSQL migration/rollback and concurrency/load checks were **not run** because this executor denied Unix-socket creation after an official local PostgreSQL build. See the [optional isolated fixture](POSTGRES_VALIDATION.md); SQL mocks are not substitutes.

Verify ordinary login, admin authorization, prepaid/subscription charging, billing idempotency, expiry cancellation and the cumulative soft cap before production. Never reset the cumulative meter or remove policy columns to bypass controls. Rollbacks require stopped traffic and a verified recovery plan.

Configure authorized OAuth secrets through `ANTIGRAVITY_OAUTH_CLIENT_SECRET`, `GEMINI_CLI_OAUTH_CLIENT_SECRET`, or an approved custom Gemini OAuth client. No third-party shared secret is bundled. Missing OAuth configuration fails explicitly. Only read-only validation CI remains; publishing source does not authorize deployment. Preserve LGPL-3.0 attribution and corresponding-source obligations.

Keep `gateway.usage_record.overflow_policy: sync` (the default). Temporary billable requests are rejected under `drop`/`sample`. Synchronous overflow fallback prevents intentional dropping; it is not a crash-recovery ledger. Interrupted requests settle observed usage only; missing final provider usage can undercount and cannot guarantee reconciliation with the provider invoice.

Use `make test-carpool-backend` by default. The inherited full suite contains provider-side helpers; one dummy-token privacy request caused review to stop a full run. Identified fixtures were corrected, and automatic CI is restricted to reviewed in-memory/localhost checks plus compilation/static analysis. Audit/isolate remaining broad supplier/integration tests before running them; never inject production credentials into unit tests.

Do not overwrite this customization with the upstream binary self-updater. Upgrade from reviewed source in this repository, retaining a verifiable version and backups.


## V19 为什么现有页面不会自动变化 / Why an existing site does not change automatically

GitHub 上的源码更新不会修改已运行的服务器。V19 需要从本仓库新版源码重新构建含前端的应用，并由部署者按既有升级/备份流程替换运行实例。未更新实例仍会显示旧布局；只是点击原来的 `/admin/dashboard` 也仍会进入保留的系统总览。更新后，标准模式管理员没有指定回跳链接时进入 `/admin/carpool`；可以看到侧栏四个工作流与 `CARPOOL · V19` 标识。先核对实际运行构建，不要将旧后端版本徽标单独当成源码是否更新的证据。本任务没有操作你的服务器。

Publishing source on GitHub does not alter a running server. The operator must rebuild this revision with the frontend embedded and replace the instance through an approved backup/upgrade process. An unchanged instance retains its previous layout; an explicit `/admin/dashboard` link intentionally still opens the retained system overview. With V19 deployed, standard-mode administrators without an explicit return link enter `/admin/carpool`, with four sidebar workflows and the `CARPOOL · V19` marker. Verify the running build rather than relying only on the upstream runtime-version badge. No server was modified by this task.
