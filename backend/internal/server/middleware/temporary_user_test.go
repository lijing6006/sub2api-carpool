//go:build unit

package middleware

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTemporaryGatewayRestrictions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	for _, tc := range []struct {
		name, path, mode string
		spent            float64
		skip             bool
		dbError          bool
		want             int
	}{
		{"sync", "/v1/chat/completions", config.RunModeStandard, 0, false, false, 0},
		{"balance topup cannot escape cap", "/v1/chat/completions", config.RunModeStandard, 10, false, false, 429},
		{"usage readable at cap", "/v1/usage", config.RunModeStandard, 10, true, false, 0},
		{"simple mode denied", "/v1/messages", config.RunModeSimple, 0, false, false, 403},
		{"async denied", "/v1/images/generations/async", config.RunModeStandard, 0, false, false, 403},
		{"batch denied", "/v1/images/batches", config.RunModeStandard, 0, false, false, 403},
		{"realtime denied", "/realtime", config.RunModeStandard, 0, false, false, 403},
		{"persistent cache denied", "/v1beta/cachedContents", config.RunModeStandard, 0, false, false, 403},
		{"gemini batch denied", "/v1beta/models/test:batchGenerateContent", config.RunModeStandard, 0, false, false, 403},
		{"database error fails closed", "/v1/messages", config.RunModeStandard, 0, false, true, 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			user := &service.User{ID: 7, Role: service.RoleUser, Status: service.StatusActive, Balance: 10000, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget, TemporarySpentUSD: tc.spent}
			repo := &stubUserRepo{getByID: func(context.Context, int64) (*service.User, error) {
				if tc.dbError {
					return nil, errors.New("db down")
				}
				return user, nil
			}}
			cfg := &config.Config{RunMode: tc.mode}
			svc := service.NewAPIKeyService(nil, repo, nil, nil, nil, nil, cfg)
			cached := *user
			cached.TemporarySpentUSD = 0
			key := &service.APIKey{User: &cached}
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, tc.path, nil)
			status, _, _, cancel := validateTemporaryGatewayAccess(c, svc, key, cfg, tc.skip)
			if cancel != nil {
				defer cancel()
			}
			require.Equal(t, tc.want, status)
			if status == 0 {
				deadline, ok := c.Request.Context().Deadline()
				require.True(t, ok)
				require.Equal(t, expires, deadline)
			}
		})
	}
}

func TestTemporaryExpiredJWTDeniedAfterIssuance(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	user := &service.User{ID: 77, Email: "temp@example.test", Role: service.RoleUser, Status: service.StatusActive, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}
	router, auth := newJWTTestEnv(map[int64]*service.User{77: user})
	token, err := auth.GenerateToken(context.Background(), user)
	require.NoError(t, err)
	expires = time.Now().Add(-time.Second)
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	out := httptest.NewRecorder()
	router.ServeHTTP(out, req)
	require.Equal(t, http.StatusUnauthorized, out.Code)
}

func TestTemporarySynchronousRouteAllowlist(t *testing.T) {
	for _, path := range []string{"/v1/live", "/contents/generations/tasks", "/api/v3/contents/generations/tasks", "/v1/custom-voices", "/v1/unknown", "/v1/images/tasks/123"} {
		require.False(t, temporarySynchronousRoute(http.MethodPost, path), path)
	}
	require.False(t, temporarySynchronousRoute(http.MethodGet, "/v1/responses"))
	for _, path := range []string{"/responses", "/v1/messages", "/backend-api/codex/responses/compact", "/antigravity/v1/messages", "/v1beta/models/test:streamGenerateContent"} {
		require.True(t, temporarySynchronousRoute(http.MethodPost, path), path)
	}
}

func TestTemporaryResponsesBackgroundAndBodyPreservation(t *testing.T) {
	for _, tc := range []struct {
		body string
		want int
	}{
		{`{"model":"test","stream":true,"background":false}`, 0},
		{`{"background":true}`, 403},
		{`{"background":true,"background":false}`, 403},
		{`{"Background":true}`, 403},
		{`{"background":"true"}`, 403},
		{`{`, 400},
	} {
		t.Run(tc.body, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(tc.body))
			status, _, _ := validateTemporaryResponsesBody(c)
			require.Equal(t, tc.want, status)
			body, err := io.ReadAll(c.Request.Body)
			require.NoError(t, err)
			require.Equal(t, tc.body, string(body), "body must survive preflight")
		})
	}
}

func TestTemporaryGatewayRejectsUpgrade(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	user := &service.User{ID: 7, Status: service.StatusActive, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}
	repo := &stubUserRepo{getByID: func(context.Context, int64) (*service.User, error) { return user, nil }}
	cfg := &config.Config{RunMode: config.RunModeStandard}
	svc := service.NewAPIKeyService(nil, repo, nil, nil, nil, nil, cfg)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("Upgrade", "websocket")
	status, _, _, cancel := validateTemporaryGatewayAccess(c, svc, &service.APIKey{User: user}, cfg, false)
	require.Nil(t, cancel)
	require.Equal(t, 403, status)
}

func TestTemporaryGatewayRequiresNonDroppingUsagePolicy(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	for _, policy := range []string{"", "sync", "drop", "sample", " DROP "} {
		t.Run(policy, func(t *testing.T) {
			user := &service.User{ID: 7, Role: service.RoleUser, Status: service.StatusActive, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}
			repo := &stubUserRepo{getByID: func(context.Context, int64) (*service.User, error) { return user, nil }}
			cfg := &config.Config{RunMode: config.RunModeStandard}
			cfg.Gateway.UsageRecord.OverflowPolicy = policy
			svc := service.NewAPIKeyService(nil, repo, nil, nil, nil, nil, cfg)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
			status, code, _, cancel := validateTemporaryGatewayAccess(c, svc, &service.APIKey{User: user}, cfg, false)
			if cancel != nil {
				defer cancel()
			}
			if policy == "" || policy == "sync" {
				require.Zero(t, status)
			} else {
				require.Equal(t, http.StatusForbidden, status)
				require.Equal(t, "TEMPORARY_USER_USAGE_RECORD_POLICY_UNSUPPORTED", code)
			}
			// The operator's existing policy is unchanged for ordinary members.
			status, _, _, _ = validateTemporaryGatewayAccess(c, nil, &service.APIKey{User: &service.User{Role: service.RoleUser}}, cfg, false)
			require.Zero(t, status)
			// Read-only usage remains accessible even when spending is blocked.
			status, _, _, cancel = validateTemporaryGatewayAccess(c, svc, &service.APIKey{User: user}, cfg, true)
			if cancel != nil {
				defer cancel()
			}
			require.Zero(t, status)
		})
	}
}
