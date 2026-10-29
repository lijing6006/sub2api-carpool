//go:build unit

package service

import (
	"context"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// This is an in-memory integration of the account-test path. The HTTPUpstream
// is a recorder and never performs a network request.
func TestAccountDiagnosticFullOpenAIPathUsesFixtureAndDeadline(t *testing.T) {
	account := &Account{ID: 1, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Concurrency: 1, Credentials: map[string]any{"access_token": "mock-token"}}
	repo := &openAIAccountTestRepo{mockAccountRepoForGemini: mockAccountRepoForGemini{accountsByID: map[int64]*Account{1: account}}}
	body := "data: {\"type\":\"response.output_text.delta\",\"delta\":\"{\\\"sum\\\":42,\\\"sorted\\\":[1,2,3]}\"}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"usage\":{\"output_tokens\":16}}}\n\n"
	upstream := &httpUpstreamRecorder{resp: &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}}
	service := &AccountTestService{accountRepo: repo, httpUpstream: upstream}
	c, recorder := newTestContext()
	require.NoError(t, service.TestAccountConnection(c, 1, "gpt-5.4", "arbitrary user prompt must be ignored", "diagnostic"))
	require.Len(t, upstream.requests, 1)
	require.Equal(t, AccountDiagnosticPrompt, gjson.GetBytes(upstream.lastBody, "input.0.content.0.text").String())
	deadline, ok := upstream.lastReq.Context().Deadline()
	require.True(t, ok)
	require.LessOrEqual(t, time.Until(deadline), time.Minute)
	require.Contains(t, recorder.Body.String(), `"output_tokens":16`)
	require.Contains(t, recorder.Body.String(), `"rubric_id":"json-arithmetic-v1"`)
	require.NotContains(t, recorder.Body.String(), "mock-token")
}

func TestAccountDiagnosticRejectsMappedMediaBeforeUpstream(t *testing.T) {
	account := &Account{ID: 1, Platform: PlatformOpenAI, Type: AccountTypeAPIKey, Credentials: map[string]any{"model_mapping": map[string]any{"Friendly-Text": "gpt-image-1"}}}
	repo := &openAIAccountTestRepo{mockAccountRepoForGemini: mockAccountRepoForGemini{accountsByID: map[int64]*Account{1: account}}}
	upstream := &httpUpstreamRecorder{}
	service := &AccountTestService{accountRepo: repo, httpUpstream: upstream}
	c, _ := newTestContext()
	require.Error(t, service.TestAccountConnection(c, 1, "Friendly-Text", "", "diagnostic"))
	require.Empty(t, upstream.requests)
}

func TestAccountDiagnosticDoesNotMutateAccountHealth(t *testing.T) {
	account := &Account{ID: 1, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Concurrency: 1, Credentials: map[string]any{"access_token": "mock-token"}}
	repo := &openAIAccountTestRepo{mockAccountRepoForGemini: mockAccountRepoForGemini{accountsByID: map[int64]*Account{1: account}}}
	upstream := &httpUpstreamRecorder{resp: &http.Response{StatusCode: http.StatusUnauthorized, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("provider secret body"))}}
	service := &AccountTestService{accountRepo: repo, httpUpstream: upstream}
	c, recorder := newTestContext()
	require.Error(t, service.TestAccountConnection(c, 1, "gpt-5.4", "", "diagnostic"))
	require.Zero(t, repo.setErrorID)
	require.Nil(t, repo.updatedExtra)
	require.NotContains(t, recorder.Body.String(), "provider secret body")
}

// A diagnostic must not turn a probe into a production scheduling/health write.
func TestAccountDiagnosticChat429DoesNotReconcileProductionState(t *testing.T) {
	for _, diagnostic := range []bool{true, false} {
		name := "normal-test-preserves-reconciliation"
		if diagnostic {
			name = "diagnostic-is-read-only"
		}
		t.Run(name, func(t *testing.T) {
			account := &Account{ID: 88, Platform: PlatformOpenAI, Type: AccountTypeAPIKey, Status: StatusError, ErrorMessage: "existing-state", Concurrency: 1}
			repo := &openAIAccountTestRepo{}
			response := newJSONResponse(http.StatusTooManyRequests, `{"error":{"type":"usage_limit_reached","message":"private-provider-error","resets_at":1999999999}}`)
			response.Header.Set("x-codex-primary-used-percent", "100")
			response.Header.Set("x-codex-primary-reset-after-seconds", "3600")
			response.Header.Set("x-codex-primary-window-minutes", "300")
			upstream := &httpUpstreamRecorder{resp: response}
			service := &AccountTestService{accountRepo: repo, httpUpstream: upstream}
			c, recorder := newTestContext()
			if diagnostic {
				c.Set(accountDiagnosticContextKey, &accountDiagnosticState{started: time.Now()})
			}
			err := service.testOpenAIChatCompletionsConnection(c, account, "gpt-5.4", "", "https://api.openai.com", "test-only-token")
			require.Error(t, err)
			require.Len(t, upstream.requests, 1)
			if diagnostic {
				require.Zero(t, repo.rateLimitedID)
				require.Zero(t, repo.clearedErrorID)
				require.Zero(t, repo.setErrorID)
				require.Nil(t, repo.updatedExtra)
				require.Equal(t, StatusError, account.Status)
				require.Equal(t, "existing-state", account.ErrorMessage)
				require.Nil(t, account.RateLimitResetAt)
				require.NotContains(t, recorder.Body.String(), "private-provider-error")
				require.NotContains(t, recorder.Body.String(), "test-only-token")
			} else {
				require.Equal(t, account.ID, repo.rateLimitedID)
				require.Equal(t, account.ID, repo.clearedErrorID)
				require.NotNil(t, account.RateLimitResetAt)
			}
		})
	}
}

type diagnosticCountingBody struct {
	io.Reader
	bytesRead int
	closed    bool
}

func (b *diagnosticCountingBody) Read(p []byte) (int, error) {
	n, err := b.Reader.Read(p)
	b.bytesRead += n
	return n, err
}
func (b *diagnosticCountingBody) Close() error { b.closed = true; return nil }

func TestAccountDiagnosticWireLimitCoversIgnoredAndUnterminatedFrames(t *testing.T) {
	service := &AccountTestService{}
	processors := map[string]func(*gin.Context, io.Reader) error{
		"anthropic": service.processClaudeStream,
		"gemini":    service.processGeminiStream,
		"responses": service.processOpenAIStream,
		"chat":      service.processOpenAIChatCompletionsStream,
	}
	for name, process := range processors {
		for _, payload := range []string{strings.Repeat("x", accountDiagnosticMaxWireBytes*4), strings.Repeat("event: ignored\n", accountDiagnosticMaxWireBytes)} {
			t.Run(name, func(t *testing.T) {
				c, recorder := newTestContext()
				ctx, cancel := context.WithCancel(c.Request.Context())
				defer cancel()
				c.Set(accountDiagnosticContextKey, &accountDiagnosticState{started: time.Now(), cancel: cancel})
				body := &diagnosticCountingBody{Reader: strings.NewReader(payload)}
				response := &http.Response{Body: body}
				boundAccountDiagnosticResponse(c, response)
				require.Error(t, process(c, response.Body))
				require.LessOrEqual(t, body.bytesRead, accountDiagnosticMaxWireBytes)
				require.ErrorIs(t, ctx.Err(), context.Canceled)
				require.NotContains(t, recorder.Body.String(), strings.Repeat("x", 100))
				require.NoError(t, response.Body.Close())
				require.True(t, body.closed)
			})
		}
	}
}
func TestAccountDiagnosticWireLimitCoversProviderErrors(t *testing.T) {
	account := &Account{ID: 1, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Concurrency: 1, Credentials: map[string]any{"access_token": "mock-token"}}
	repo := &openAIAccountTestRepo{mockAccountRepoForGemini: mockAccountRepoForGemini{accountsByID: map[int64]*Account{1: account}}}
	body := &diagnosticCountingBody{Reader: strings.NewReader(strings.Repeat("private-error-body", accountDiagnosticMaxWireBytes))}
	upstream := &httpUpstreamRecorder{resp: &http.Response{StatusCode: http.StatusBadGateway, Header: make(http.Header), Body: body}}
	service := &AccountTestService{accountRepo: repo, httpUpstream: upstream}
	c, recorder := newTestContext()
	require.Error(t, service.TestAccountConnection(c, 1, "gpt-5.4", "", "diagnostic"))
	require.LessOrEqual(t, body.bytesRead, accountDiagnosticMaxWireBytes)
	require.True(t, body.closed)
	require.NotContains(t, recorder.Body.String(), "private-error-body")
}
func TestAccountDiagnosticWireLimitDoesNotChangeNormalTests(t *testing.T) {
	c, _ := newTestContext()
	body := &diagnosticCountingBody{Reader: strings.NewReader(strings.Repeat("x", accountDiagnosticMaxWireBytes*2))}
	response := &http.Response{Body: body}
	boundAccountDiagnosticResponse(c, response)
	require.Same(t, body, response.Body)
	data, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.Len(t, data, accountDiagnosticMaxWireBytes*2)
}
