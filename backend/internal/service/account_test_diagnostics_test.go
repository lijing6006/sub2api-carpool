package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func diagnosticTestContext() (*gin.Context, *httptest.ResponseRecorder, *accountDiagnosticState) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/diagnostic", nil)
	state := &accountDiagnosticState{started: time.Now().Add(-time.Second)}
	c.Set(accountDiagnosticContextKey, state)
	return c, recorder, state
}

func TestAccountDiagnosticPayloadIsOptInAndFixed(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	payload := createOpenAITestPayload("gpt-5.4", false)
	before, err := json.Marshal(payload)
	require.NoError(t, err)
	applyAccountDiagnosticPayload(c, payload, "responses", false)
	after, err := json.Marshal(payload)
	require.NoError(t, err)
	require.Equal(t, before, after, "ordinary tests must not change")
	c.Set(accountDiagnosticContextKey, &accountDiagnosticState{})
	applyAccountDiagnosticPayload(c, payload, "responses", false)
	encoded, err := json.Marshal(payload)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `Compute 17 + 25`)
	require.Equal(t, 128, payload["max_output_tokens"])
	oauth := createOpenAITestPayload("gpt-5.4", true)
	applyAccountDiagnosticPayload(c, oauth, "responses", true)
	require.NotContains(t, oauth, "max_output_tokens", "Codex rejects this field")
	anthropic, err := createTestPayload("claude-sonnet-4-6")
	require.NoError(t, err)
	applyAccountDiagnosticPayload(c, anthropic, "anthropic", false)
	require.Equal(t, 128, anthropic["max_tokens"])
}

func TestAccountDiagnosticValidatesBeforeAnyUpstreamCall(t *testing.T) {
	account := &Account{Platform: PlatformOpenAI, Type: AccountTypeAPIKey}
	require.NoError(t, validateAccountDiagnostic(account, "gpt-5.4", AccountTestOptions{}))
	for _, model := range []string{"", "gpt-image-1", "grok-video", "audio-preview", "model\nheader", strings.Repeat("x", 201)} {
		require.Error(t, validateAccountDiagnostic(account, model, AccountTestOptions{}))
	}
	require.Error(t, validateAccountDiagnostic(account, "gpt-5.4", AccountTestOptions{ImageDataURL: "data:image/png;base64,test"}))
	require.Error(t, validateAccountDiagnostic(&Account{Platform: PlatformGrok}, "grok-text", AccountTestOptions{}))
	account.Credentials = map[string]any{"model_mapping": map[string]any{"Text-Alias": "gpt-image-1"}}
	require.Error(t, validateAccountDiagnostic(account, "Text-Alias", AccountTestOptions{}))
}

func TestAccountDiagnosticMetricsUseOnlyReportedTokens(t *testing.T) {
	c, _, state := diagnosticTestContext()
	first := time.Now().Add(-500 * time.Millisecond)
	state.firstContent = &first
	event := TestEvent{Type: "test_complete", Success: true}
	require.True(t, decorateAccountDiagnosticEvent(c, &event))
	require.NotNil(t, event.Metrics.FirstTokenMs)
	require.Nil(t, event.Metrics.OutputTokens)
	require.Nil(t, event.Metrics.TokensPerSecond)
	c, _, state = diagnosticTestContext()
	state.firstContent = &first
	recordAccountDiagnosticUsage(c, map[string]any{"response": map[string]any{"usage": map[string]any{"output_tokens": float64(12)}}}, "responses")
	event = TestEvent{Type: "test_complete", Success: true}
	require.True(t, decorateAccountDiagnosticEvent(c, &event))
	require.EqualValues(t, 12, *event.Metrics.OutputTokens)
	require.Greater(t, *event.Metrics.TokensPerSecond, float64(0))
	for _, protocol := range []string{"anthropic", "chat", "gemini"} {
		c, _, state = diagnosticTestContext()
		key, count := "usage", "output_tokens"
		if protocol == "chat" {
			count = "completion_tokens"
		}
		if protocol == "gemini" {
			key, count = "usageMetadata", "candidatesTokenCount"
		}
		recordAccountDiagnosticUsage(c, map[string]any{key: map[string]any{count: float64(9)}}, protocol)
		require.EqualValues(t, 9, *state.outputTokens)
	}
}

func TestAccountDiagnosticBoundsOutputAndSanitizesErrors(t *testing.T) {
	c, _, state := diagnosticTestContext()
	ctx, cancel := context.WithCancel(context.Background())
	state.cancel = cancel
	event := TestEvent{Type: "content", Text: strings.Repeat("a", accountDiagnosticMaxOutputBytes+1)}
	require.True(t, decorateAccountDiagnosticEvent(c, &event))
	require.Equal(t, "error", event.Type)
	require.Error(t, ctx.Err())
	require.Empty(t, event.Text)
	require.False(t, decorateAccountDiagnosticEvent(c, &TestEvent{Type: "test_complete", Success: true}), "late success must not override failure")
	c, _, _ = diagnosticTestContext()
	event = TestEvent{Type: "error", Error: "Authorization: Bearer secret"}
	require.True(t, decorateAccountDiagnosticEvent(c, &event))
	require.NotContains(t, event.Error, "secret")
	require.Nil(t, event.Metrics.TokensPerSecond)
}

func TestAccountDiagnosticEmptyAndInterruptedStreamsDoNotSucceed(t *testing.T) {
	service := &AccountTestService{}
	c, recorder, _ := diagnosticTestContext()
	err := service.processClaudeStream(c, strings.NewReader("data: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"hello\"}}\n\n"))
	require.Error(t, err)
	require.Contains(t, recorder.Body.String(), `"type":"error"`)
	c, recorder, _ = diagnosticTestContext()
	err = service.processGeminiStream(c, strings.NewReader("data: {\"candidates\":[]}\n\n"))
	require.Error(t, err)
	require.Contains(t, recorder.Body.String(), `"type":"error"`)
	c, _, _ = diagnosticTestContext()
	event := TestEvent{Type: "test_complete", Success: true}
	require.True(t, decorateAccountDiagnosticEvent(c, &event))
	require.False(t, event.Success)
	// Existing default probes retain their EOF behavior.
	plain, _ := gin.CreateTestContext(httptest.NewRecorder())
	plain.Request = httptest.NewRequest("POST", "/test", nil)
	require.NoError(t, service.processClaudeStream(plain, strings.NewReader("")))
}

func TestAccountDiagnosticParserKeepsProviderUsageAndSkipsThoughts(t *testing.T) {
	service := &AccountTestService{}
	c, recorder, _ := diagnosticTestContext()
	input := "data: {\"candidates\":[{\"content\":{\"parts\":[{\"thought\":true,\"text\":\"private reasoning\"},{\"text\":\"{\\\"sum\\\":42,\\\"sorted\\\":[1,2,3]}\"}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"candidatesTokenCount\":14}}\n\n"
	require.NoError(t, service.processGeminiStream(c, strings.NewReader(input)))
	require.NotContains(t, recorder.Body.String(), "private reasoning")
	require.Contains(t, recorder.Body.String(), `"output_tokens":14`)
	require.Contains(t, recorder.Body.String(), `"rubric_id":"json-arithmetic-v1"`)
}

func TestAccountDiagnosticDoesNotScoreTruncatedGenerations(t *testing.T) {
	service := &AccountTestService{}
	tests := []struct {
		name string
		run  func(*gin.Context, io.Reader) error
		body string
	}{
		{"claude", service.processClaudeStream, "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"max_tokens\"}}\n\n"},
		{"gemini", service.processGeminiStream, "data: {\"candidates\":[{\"finishReason\":\"MAX_TOKENS\"}]}\n\n"},
		{"chat", service.processOpenAIChatCompletionsStream, "data: {\"choices\":[{\"finish_reason\":\"length\"}]}\n\n"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, recorder, _ := diagnosticTestContext()
			require.Error(t, test.run(c, strings.NewReader(test.body)))
			require.Contains(t, recorder.Body.String(), `"type":"error"`)
			require.NotContains(t, recorder.Body.String(), `"success":true`)
		})
	}
}
