.PHONY: build build-backend build-frontend test test-backend test-frontend test-frontend-critical test-carpool-frontend test-carpool-backend

FRONTEND_CRITICAL_VITEST := \
	src/i18n/__tests__/localeKeyCompleteness.spec.ts \
	src/api/__tests__/client.spec.ts \
	src/api/__tests__/tokenRefresh.spec.ts \
	src/api/__tests__/keys.bulkUpdate.spec.ts \
	src/composables/__tests__/useModelWhitelist.spec.ts \
	src/components/account/__tests__/OpenAIReferralCell.spec.ts \
	src/components/account/__tests__/OpenAIReferralCell.transport.spec.ts \
	src/components/account/__tests__/OpenAIQuotaResetCell.spark_shadow.spec.ts \
	src/constants/__tests__/platforms.spec.ts \
	src/components/account/__tests__/credentialsBuilder.platformCatalog.spec.ts \
	src/components/account/__tests__/CreateAccountModal.spec.ts \
	src/components/account/__tests__/EditAccountModal.spec.ts \
	src/components/account/__tests__/credentialsBuilder.spec.ts \
	src/components/account/__tests__/OpenCodeGoProtocolRulesEditor.spec.ts \
	src/components/keys/__tests__/BulkEditKeysModal.spec.ts \
	src/components/admin/user/__tests__/UserPlatformQuotaModal.spec.ts \
	src/views/user/__tests__/KeysView.spec.ts \
	src/api/__tests__/channelMonitorV2.spec.ts \
	src/views/auth/__tests__/LinuxDoCallbackView.spec.ts \
	src/views/auth/__tests__/WechatCallbackView.spec.ts \
	src/views/user/__tests__/PaymentView.spec.ts \
	src/views/user/__tests__/PaymentResultView.spec.ts \
	src/views/user/__tests__/ChannelStatusView.mode.spec.ts \
	src/components/user/profile/__tests__/ProfileInfoCard.spec.ts \
	src/components/user/profile/__tests__/ProfileIdentityBindingsSection.spec.ts \
	src/views/admin/__tests__/SettingsView.spec.ts \
	src/features/channel-monitor-v2/__tests__/designSystem.structure.spec.ts \
	src/features/channel-monitor-v2/__tests__/monitorFormat.spec.ts \
	src/features/channel-monitor-v2/__tests__/monitorZoom.spec.ts \
	src/components/admin/channel/__tests__/PricingEntryCard.modelDefaultPrice.spec.ts


# 拼车回归 / Carpool regressions: mocked data only, no paid upstream calls.
FRONTEND_CARPOOL_VITEST := \
 src/components/carpool/__tests__ \
 src/utils/__tests__/carpoolOverview.spec.ts \
 src/utils/__tests__/carpoolFilters.spec.ts \
 src/utils/__tests__/modelDiagnostics.spec.ts \
 src/utils/__tests__/modelDiagnosticReport.spec.ts \
 src/router/__tests__/carpool-access.spec.ts \
 src/api/__tests__/admin.users.balance.idempotency.spec.ts

# 一键编译前后端
build: build-backend build-frontend

# 编译后端（复用 backend/Makefile）
build-backend:
	@$(MAKE) -C backend build

# 编译前端（需要已安装依赖）
build-frontend:
	@pnpm --dir frontend run build

# 运行测试（后端 + 前端）
test: test-backend test-frontend

test-backend:
	@$(MAKE) -C backend test

test-frontend:
	@pnpm --dir frontend run lint:check
	@pnpm --dir frontend run typecheck
	@$(MAKE) test-frontend-critical

test-frontend-critical:
	@pnpm --dir frontend exec vitest run $(FRONTEND_CRITICAL_VITEST) $(FRONTEND_CARPOOL_VITEST)

test-carpool-frontend:
	@pnpm --dir frontend exec vitest run $(FRONTEND_CARPOOL_VITEST) src/i18n/__tests__/localeKeyCompleteness.spec.ts

# 审核过的内存/localhost 回归；不运行上游完整集成或真实供应商测试。
# Reviewed in-memory/localhost regressions; not the upstream live/integration suite.
CARPOOL_BACKEND_TESTS := ^(TestTemporary(User|Expiry|Gateway|Billing|ExpiredJWT|SynchronousRoute|Responses)|TestAccountDiagnostic|TestUserTemporarySerialization|TestAPIContracts|TestAliyunCaptchaVerifier_|TestTokenRefreshService_RefreshWithRetry_Antigravity$$|TestValidateCreateParams_CheckModeMatrix$$)

test-carpool-backend:
	@cd backend && go test -tags=unit -p 1 ./internal/service ./internal/repository ./internal/handler/admin ./internal/server/middleware ./internal/handler/dto ./internal/server -run '$(CARPOOL_BACKEND_TESTS)' -count=1
