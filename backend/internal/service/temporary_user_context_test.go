//go:build unit

package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTemporaryExpirySurvivesUpstreamDetachment(t *testing.T) {
	for _, tc := range []struct {
		name   string
		detach func(context.Context) (context.Context, context.CancelFunc)
	}{
		{"all upstream", detachUpstreamContext},
		{"stream upstream", func(ctx context.Context) (context.Context, context.CancelFunc) {
			return detachStreamUpstreamContext(ctx, true)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			key := upstreamContextTestKey("temporary-policy-test")
			client, cancelClient := context.WithCancel(context.WithValue(context.Background(), key, "kept"))
			defer cancelClient()
			expires := time.Now().Add(100 * time.Millisecond)
			request, finish := WithTemporaryUserExpiry(client, expires)
			defer finish()
			upstream, release := tc.detach(request)
			// Real gateway callers release immediately after request construction.
			release()
			cancelClient()
			require.NoError(t, upstream.Err(), "client disconnect must not erase usage accounting")
			require.Equal(t, "kept", upstream.Value(key))
			deadline, ok := upstream.Deadline()
			require.True(t, ok)
			require.Equal(t, expires, deadline)

			// Retries detach an already-detached context; the same policy survives.
			retry, releaseRetry := tc.detach(upstream)
			releaseRetry()
			child, cancelChild := context.WithCancel(retry)
			defer cancelChild()
			select {
			case <-child.Done():
			case <-time.After(time.Second):
				t.Fatal("upstream ignored temporary-member expiry")
			}
			require.ErrorIs(t, retry.Err(), context.DeadlineExceeded)
			require.ErrorIs(t, child.Err(), context.DeadlineExceeded)
			require.ErrorIs(t, context.Cause(child), context.DeadlineExceeded)
		})
	}
}

func TestTemporaryExpiryHandlerCleanupAndBillingIndependence(t *testing.T) {
	request, finish := WithTemporaryUserExpiry(context.Background(), time.Now().Add(time.Hour))
	upstream, release := detachUpstreamContext(request)
	release()
	billing, cancelBilling := detachedBillingContext(request)
	defer cancelBilling()
	finish()
	require.ErrorIs(t, request.Err(), context.Canceled)
	require.ErrorIs(t, upstream.Err(), context.Canceled, "handler cleanup owns the policy timer")
	require.NoError(t, billing.Err(), "usage settlement must survive handler cleanup")
	persistence, releasePersistence := detachUpstreamContext(billing)
	defer releasePersistence()
	require.NoError(t, persistence.Err(), "post-billing persistence must not restore the expired policy")
	_, hasDeadline := persistence.Deadline()
	require.False(t, hasDeadline)

	expired, cancelExpired := WithTemporaryUserExpiry(context.Background(), time.Now().Add(-time.Second))
	defer cancelExpired()
	settlement, cancelSettlement := detachedBillingContext(expired)
	defer cancelSettlement()
	require.NoError(t, settlement.Err(), "expiry must not cancel final usage settlement")
}

// Both cases use an in-memory HTTPUpstream, never an actual provider connection.
func TestTemporaryExpiryCancelsEmbeddingsBeforeUpstreamHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	upstream := &blockingOpenAIResponseHeaderUpstream{canceled: make(chan struct{})}
	svc := &OpenAIGatewayService{cfg: &config.Config{}, httpUpstream: upstream}
	body := []byte(`{"model":"text-embedding-3-small","input":"hello"}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	request, finish := WithTemporaryUserExpiry(context.Background(), time.Now().Add(100*time.Millisecond))
	defer finish()
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/embeddings", strings.NewReader(string(body))).WithContext(request)
	account := &Account{ID: 1, Platform: PlatformOpenAI, Type: AccountTypeAPIKey, Credentials: map[string]any{"api_key": "fake-test-key"}}
	_, err := svc.ForwardEmbeddings(request, c, account, body, "")
	require.Error(t, err)
	select {
	case <-upstream.canceled:
	default:
		t.Fatal("embeddings upstream was not canceled at temporary-member expiry")
	}
}

func TestTemporaryExpiryCancelsActiveChatStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{"model":"gpt-5.4","messages":[{"role":"user","content":"hello"}],"stream":true}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	request, finish := WithTemporaryUserExpiry(context.Background(), time.Now().Add(100*time.Millisecond))
	defer finish()
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(string(body))).WithContext(request)
	stream := newContextBoundBlockingReadCloser([]byte("data: {\"type\":\"response.created\",\"response\":{\"id\":\"temporary-test\"}}\n\n"))
	// Bound a regression failure without depending on a provider or a long idle timeout.
	guard := time.AfterFunc(time.Second, stream.forceUnblock)
	defer guard.Stop()
	defer stream.forceUnblock()
	svc := &OpenAIGatewayService{cfg: rawChatCompletionsTestConfig(), httpUpstream: &contextBoundHTTPUpstream{body: stream}}
	_, err := svc.ForwardAsChatCompletions(request, c, rawChatCompletionsTestAccount(), body, "", "gpt-5.1")
	require.Error(t, err)
	require.NotNil(t, stream.ctx)
	deadline, ok := stream.ctx.Deadline()
	require.True(t, ok, "active stream must retain temporary expiry")
	expected, _ := request.Deadline()
	require.Equal(t, expected, deadline)
	require.ErrorIs(t, stream.ctx.Err(), context.DeadlineExceeded)
}

func TestTemporaryExpiryPreservesHTTPToWebSocketObservedUsage(t *testing.T) {
	t.Run("connected", func(t *testing.T) { testTemporaryExpiredWebSocketUsage(t, false) })
	t.Run("client-disconnected", func(t *testing.T) { testTemporaryExpiredWebSocketUsage(t, true) })
}

func testTemporaryExpiredWebSocketUsage(t *testing.T, disconnect bool) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	client, cancelClient := context.WithCancel(context.Background())
	defer cancelClient()
	request, finish := WithTemporaryUserExpiry(client, time.Now().Add(150*time.Millisecond))
	defer finish()
	writer := &cancelOnFirstWriteResponseWriter{cancel: cancelClient}
	if !disconnect {
		writer.cancel = nil
	}
	c, _ := gin.CreateTestContext(writer)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil).WithContext(request)
	conn := &openAIWSCancelSafeConn{openAIWSCaptureConn: &openAIWSCaptureConn{
		events: [][]byte{
			[]byte(`{"type":"response.created","response":{"id":"temp-expiry","model":"gpt-5.1"}}`),
			[]byte(`{"type":"response.in_progress","response":{"id":"temp-expiry","usage":{"input_tokens":30,"output_tokens":20}}}`),
			[]byte(`{"type":"response.output_text.delta","delta":"partial"}`),
			[]byte(`{"type":"response.completed","response":{"id":"temp-expiry","model":"gpt-5.1","usage":{"input_tokens":30,"output_tokens":50}}}`),
		},
		readDelays: []time.Duration{0, 0, 0, time.Second},
	}}
	cfg := &config.Config{}
	cfg.Gateway.OpenAIWS.Enabled = true
	cfg.Gateway.OpenAIWS.APIKeyEnabled = true
	cfg.Gateway.OpenAIWS.ResponsesWebsocketsV2 = true
	cfg.Gateway.OpenAIWS.ModeRouterV2Enabled = true
	cfg.Gateway.OpenAIWS.IngressModeDefault = OpenAIWSIngressModeCtxPool
	cfg.Gateway.OpenAIWS.MaxConnsPerAccount = 1
	cfg.Gateway.OpenAIWS.MaxIdlePerAccount = 1
	cfg.Gateway.OpenAIWS.QueueLimitPerConn = 8
	cfg.Gateway.OpenAIWS.DialTimeoutSeconds = 3
	cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 5
	cfg.Gateway.OpenAIWS.WriteTimeoutSeconds = 3
	pool := newOpenAIWSConnPool(cfg)
	defer pool.Close()
	pool.setClientDialerForTest(&openAIWSClientConnCancelDialer{conn: conn})
	svc := &OpenAIGatewayService{
		cfg: cfg, httpUpstream: &httpUpstreamRecorder{}, cache: &stubGatewayCache{},
		openaiWSResolver: NewOpenAIWSProtocolResolver(cfg), toolCorrector: NewCodexToolCorrector(), openaiWSPool: pool,
	}
	account := &Account{
		ID: 9102, Platform: PlatformOpenAI, Type: AccountTypeAPIKey,
		Status: StatusActive, Schedulable: true, Concurrency: 1,
		Credentials: map[string]any{"api_key": "fake-test-key"},
		Extra:       map[string]any{"openai_apikey_responses_websockets_v2_mode": OpenAIWSIngressModeCtxPool},
	}
	result, err := svc.Forward(request, c, account, []byte(`{"model":"gpt-5.1","stream":true,"input":[{"type":"input_text","text":"hello"}]}`))
	require.ErrorIs(t, err, context.DeadlineExceeded, "expiry interrupts upstream before completion")
	require.NotNil(t, result, "observed usage must reach the existing handler settlement path")
	require.Equal(t, 30, result.Usage.InputTokens)
	require.Equal(t, 20, result.Usage.OutputTokens, "never invent the missing terminal usage")
	require.Equal(t, "gpt-5.1", result.BillingModel)
	conn.mu.Lock()
	pendingEvents := len(conn.events)
	conn.mu.Unlock()
	require.Positive(t, pendingEvents, "expiry must interrupt the delayed terminal event")

	// Exercise the existing RecordUsage pipeline with the returned result and
	// canceled request, just as the HTTP handler's partial-result branch does.
	usageRepo := &openAIRecordUsageLogRepoStub{}
	billingRepo := &openAIRecordUsageBillingRepoStub{result: &UsageBillingApplyResult{Applied: true}}
	billing := newOpenAIRecordUsageServiceWithBillingRepoForTest(usageRepo, billingRepo, &openAIRecordUsageUserRepoStub{}, &openAIRecordUsageSubRepoStub{}, nil)
	expires, _ := request.Deadline()
	budget := 10.0
	user := &User{ID: 501, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}
	require.NoError(t, billing.RecordUsage(request, &OpenAIRecordUsageInput{
		Result: result, APIKey: &APIKey{ID: 502, User: user}, User: user, Account: account,
	}))
	require.Equal(t, 1, billingRepo.calls)
	require.NoError(t, billingRepo.lastCtxErr, "final settlement is independent of access expiry")
	require.NotNil(t, billingRepo.lastCmd)
	require.Equal(t, 30, billingRepo.lastCmd.InputTokens)
	require.Equal(t, 20, billingRepo.lastCmd.OutputTokens)
	require.Positive(t, billingRepo.lastCmd.TemporaryUserCost)
	require.Equal(t, billingRepo.lastCmd.BalanceCost, billingRepo.lastCmd.TemporaryUserCost)
	require.Equal(t, 1, usageRepo.calls)
	require.NoError(t, usageRepo.lastCtxErr)
}
