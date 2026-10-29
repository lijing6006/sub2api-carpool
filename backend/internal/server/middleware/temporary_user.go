package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/httputil"
	"github.com/Wei-Shaw/sub2api/internal/pkg/requestmodel"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// Temporary-member limits apply to the whole user, irrespective of key,
// balance top-ups, or subscription assignment. In-flight requests are subject
// to the existing post-request soft spending limit, not a prepaid reservation.
func validateTemporaryGatewayAccess(c *gin.Context, svc *service.APIKeyService, key *service.APIKey, cfg *config.Config, skipBilling bool) (int, string, string, context.CancelFunc) {
	if key.User == nil || !key.User.IsTemporary() {
		return 0, "", "", nil
	}
	user, err := svc.RefreshTemporaryUser(c.Request.Context(), key.User)
	if err != nil {
		if err == service.ErrTemporaryUserExpired {
			return 403, "TEMPORARY_USER_EXPIRED", "Temporary member access has expired", nil
		}
		return 503, "TEMPORARY_USER_POLICY_UNAVAILABLE", "Unable to verify temporary member limits; retry later", nil
	}
	key.User = user
	if !user.IsActive() {
		return 401, "USER_INACTIVE", "User account is not active", nil
	}
	if !skipBilling {
		if cfg != nil && cfg.RunMode == config.RunModeSimple {
			return 403, "TEMPORARY_USER_SIMPLE_MODE_UNSUPPORTED", "Temporary members require standard billing mode", nil
		}
		if cfg != nil {
			policy := strings.ToLower(strings.TrimSpace(cfg.Gateway.UsageRecord.OverflowPolicy))
			if policy == config.UsageRecordOverflowPolicyDrop || policy == config.UsageRecordOverflowPolicySample {
				return 403, "TEMPORARY_USER_USAGE_RECORD_POLICY_UNSUPPORTED", "Temporary members require usage-record overflow policy sync; drop/sample may discard spending records", nil
			}
		}
		if !temporarySynchronousRoute(c.Request.Method, c.Request.URL.Path) || c.GetHeader("Upgrade") != "" {
			return 403, "TEMPORARY_USER_ASYNC_UNSUPPORTED", "Temporary members support audited synchronous text, embedding and image routes only; background jobs, persistent sessions and unknown routes are unavailable", nil
		}
		if status, code, message := validateTemporaryResponsesBody(c); status != 0 {
			return status, code, message, nil
		}
		if user.IsTemporaryBudgetExhausted() {
			return 429, "TEMPORARY_USER_BUDGET_EXHAUSTED", "Temporary member spending limit has been reached", nil
		}
	}
	// Bound an already-started stream by the account expiry as well.
	ctx, cancel := service.WithTemporaryUserExpiry(c.Request.Context(), *user.TemporaryExpiresAt)
	c.Request = c.Request.WithContext(ctx)
	return 0, "", "", cancel
}

// Fail closed for new gateway capabilities: a path blacklist cannot safely cover
// long-lived sessions, third-party task APIs, or future asynchronous endpoints.
func temporarySynchronousRoute(method, path string) bool {
	p := temporaryRoutePath(path)
	if method == http.MethodGet {
		return p == "/models" || (strings.HasPrefix(p, "/models/") && !strings.Contains(strings.TrimPrefix(p, "/models/"), "/"))
	}
	if method != http.MethodPost {
		return false
	}
	switch p {
	case "/messages", "/messages/count_tokens", "/chat/completions", "/responses", "/responses/compact", "/embeddings", "/images/generations", "/images/edits":
		return true
	}
	if strings.HasPrefix(p, "/models/") {
		for _, action := range []string{":generateContent", ":streamGenerateContent", ":countTokens", ":embedContent"} {
			if strings.HasSuffix(p, action) {
				return true
			}
		}
	}
	return false
}

func temporaryRoutePath(path string) string {
	for _, prefix := range []string{"/antigravity/v1beta", "/antigravity/v1", "/backend-api/codex", "/v1beta", "/v1"} {
		if strings.HasPrefix(path, prefix+"/") {
			return strings.TrimPrefix(path, prefix)
		}
	}
	return path
}

func validateTemporaryResponsesBody(c *gin.Context) (int, string, string) {
	p := temporaryRoutePath(c.Request.URL.Path)
	if c.Request.Method != http.MethodPost || (p != "/responses" && p != "/responses/compact") {
		return 0, "", ""
	}
	body, err := httputil.ReadRequestBodyWithPrealloc(c.Request)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return 413, "REQUEST_TOO_LARGE", "Request body is too large"
		}
		return 400, "INVALID_REQUEST_BODY", "Failed to read request body"
	}
	requestmodel.ResetRequestBody(c.Request, body)
	if !gjson.ValidBytes(body) || !gjson.ParseBytes(body).IsObject() {
		return 400, "INVALID_REQUEST_BODY", "Expected a JSON object"
	}
	background := false
	// Check every duplicate/case variant rather than depending on one parser's
	// first/last-key behavior; never let background work outlive account access.
	gjson.ParseBytes(body).ForEach(func(key, value gjson.Result) bool {
		if strings.EqualFold(key.String(), "background") && value.Type != gjson.False && value.Type != gjson.Null {
			background = true
		}
		return true
	})
	if background {
		return 403, "TEMPORARY_USER_ASYNC_UNSUPPORTED", "Background responses are unavailable for temporary members"
	}
	return 0, "", ""
}
