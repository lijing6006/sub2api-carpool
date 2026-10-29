# 可选真实 PostgreSQL 回归 / Optional real PostgreSQL regression

## 中文

**状态：用例已编写，实际数据库测试受执行环境阻止，没有声称通过。** 普通 mock 回归继续保持独立；这个入口不会加入默认 CI，也不会自动安装或启动数据库。

### 为什么单独提供

SQL mock 不能证明真实事务、约束和并发行为。`backend/internal/repository/temporary_user_postgres_test.go` 使用独立 `carpoolpg` 标签，直接调用现有迁移执行器、用户仓库与 `UsageBillingRepository.Apply`，不重写一套模拟计费 SQL。

目标覆盖：
- 从完整旧迁移集升级到 249，保留普通用户默认值与旧字段读写；这是字段/当前仓库兼容检查，不是执行旧版本二进制或证明降级安全。
- 并发重放迁移、已执行迁移只记录一次，以及到期/额度配对、管理员限制和非负累计额约束。
- 余额＋临时消费同事务、重复请求只扣一次、同幂等键冲突拒绝。
- 16 个相同请求竞争只有一个生效；16 个不同 Key 请求累计无丢失；明确暴露后结算软限额可被在途请求超过。
- 实际用户仓库的充值、延期、提高额度不清零累计消费；订阅用量与临时消费同时累加而不扣余额。
- 故意无效订阅导致整个结算与幂等声明回滚，修正后可重试。

### 安全前提与执行

仅使用**全新、一次性、无真实数据**的本机 PostgreSQL 数据库：
- Unix socket 目录是绝对路径，目录名以 `sub2api-carpool-pg-` 开头，无符号链接，权限严格 `0700`。
- 数据库名固定 `carpool_validation`，用户固定 `carpool_test`，public schema 必须为空；这些名称不是生产账号或内置密码。
- 服务 `listen_addresses` 应为空，不能对外监听。测试连接必须是 Unix socket，不接受 TCP、`DATABASE_URL` 或通用生产环境变量。
- 不要给此用例真实凭据、生产数据库或生产备份。它会创建表并写入虚构 `.invalid` 账户。它拒绝预先存在的业务表，不会主动删除任意数据库。

```bash
# 指向你已准备的独立一次性 socket，不是生产服务。
export CARPOOL_TEST_PG_SOCKET=/absolute/private/sub2api-carpool-pg-example
# 可选：socket 的端口后缀；默认 5432，允许 1024–65535。
# export CARPOOL_TEST_PG_PORT=5432
make test-carpool-postgres
```

Make 入口在缺少 opt-in 环境变量时直接失败，不用“跳过”冒充通过。每次完整重跑都要重新准备空的一次性数据库。完成后停止你专门创建的测试实例并清理其数据目录，保留日志；不要对未知实例执行清理。

### 本次环境证据

已从 [PostgreSQL 官方源码目录](https://www.postgresql.org/ftp/source/v18.6/) 下载 18.6，并校验官方 SHA-256：`555610c24d53e4316da5b7d3fc25c279d96856d5e0e23ee308c328c5fa881d9f`。仅在工作目录外的 scoped toolchains 非特权构建，包含 pg_trgm；缺少的 bison/flex/m4 从 Debian 官方包按官网 SHA-256 验证后仅解压到同一工具目录，不修改系统。

源码构建和 initdb 成功。第一次仅 Unix socket 的启动失败：`could not create Unix socket ... Operation not permitted`，随后 `FATAL: could not create any Unix-domain sockets`。`pg_ctl status` 确认没有运行中的服务。没有改用 TCP、提权或更换执行器绕过限制；临时数据库/socket 目录已清理，构建与启动日志保留。**真实 migration/billing 测试没有执行，因此迁移、并发、恢复和生产兼容仍需在允许的隔离环境验收。**

## English

**Status: fixture written; real database execution was environment-blocked, not passed.** This opt-in path is separate from default mocked regression/CI and never installs or starts a database automatically.

The `carpoolpg`-tagged fixture directly exercises the existing migration runner, user repository and billing `Apply`: baseline-to-249 migration and ordinary-user field compatibility; concurrent migration replay and constraints; atomic balance/temporary metering; duplicate/fingerprint protection; sixteen same-request and sixteen distinct-key concurrent settlements; retained cumulative spending after top-up/extension; subscription settlement; and rollback/retry. It explicitly tests a post-settlement soft cap, not reservation. It does not run an old executable, prove rollback safety, or substitute for recovery/load testing.

Use only a **fresh disposable database with no real data**, named `carpool_validation`, user `carpool_test`, through an absolute non-symlink Unix-socket directory with `sub2api-carpool-pg-` basename and mode `0700`. These identifiers are not production credentials. Keep server network listening disabled. The fixture refuses TCP, generic production DSNs and an existing public business schema. It writes synthetic `.invalid` fixture data and never drops an unknown database.

Set `CARPOOL_TEST_PG_SOCKET` and run `make test-carpool-postgres` as above. Optional socket-port suffix `CARPOOL_TEST_PG_PORT` defaults to 5432. The Make target fails if opt-in is missing rather than presenting skipped tests as success. Each full rerun needs a fresh disposable database; stop and clean only the instance you created, preserving logs.

The official PostgreSQL18.6 source checksum above was verified. An unprivileged scoped build, including pg_trgm, and initdb succeeded. Missing build tools came from checksum-verified official Debian packages extracted locally, not system installation. First Unix-socket-only startup failed with `Operation not permitted`, then a fatal socket-creation error. Status confirmed no running server. No TCP/elevation/alternate-executor bypass was attempted; disposable DB/socket directories were removed and logs retained. **Actual migration/billing tests were never executed**, so isolated migration/concurrency/recovery/compatibility acceptance remains outstanding.
