package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// This deliberately small fixture is a reproducible format/arithmetic check,
// not a general model-quality benchmark. Changing it requires a new rubric ID.
const AccountDiagnosticPrompt = `Reply with only one JSON object, no Markdown or explanation. Compute 17 + 25 and return the answer as the numeric value of "sum". Sort [3, 1, 2] ascending and return it as "sorted". Use exactly these two keys.`
const accountDiagnosticContextKey = "account_diagnostic_v1"
const accountDiagnosticMaxOutputBytes = 4096

// AccountDiagnosticMetrics uses server-observed stream timings and provider
// usage. Nil fields mean unavailable; token throughput is never estimated.
type AccountDiagnosticMetrics struct {
	RubricID        string   `json:"rubric_id"`
	TotalMs         int64    `json:"total_ms"`
	FirstTokenMs    *int64   `json:"first_token_ms"`
	OutputTokens    *int64   `json:"output_tokens"`
	TokensPerSecond *float64 `json:"tokens_per_second"`
}

type accountDiagnosticState struct {
	started      time.Time
	firstContent *time.Time
	outputTokens *int64
	outputBytes  int
	ended        bool
	cancel       context.CancelFunc
}

func accountDiagnostic(c *gin.Context) *accountDiagnosticState {
	value, ok := c.Get(accountDiagnosticContextKey)
	if !ok {
		return nil
	}
	state, _ := value.(*accountDiagnosticState)
	return state
}

func validateAccountDiagnostic(account *Account, model string, opts AccountTestOptions) error {
	if account == nil || account.IsSyntheticUITest() || account.IsBedrock() {
		return fmt.Errorf("diagnostic requires a real configured streaming account")
	}
	if account.Platform != PlatformAnthropic && account.Platform != PlatformOpenAI && account.Platform != PlatformGemini {
		return fmt.Errorf("diagnostic currently supports Anthropic, OpenAI, and Gemini text models")
	}
	model = strings.TrimSpace(model)
	mappedModel := strings.ToLower(account.GetMappedModel(model))
	model = strings.ToLower(model)
	if model == "" || len(model) > 200 || strings.ContainsAny(model, "\r\n\x00") || len(mappedModel) > 200 || strings.ContainsAny(mappedModel, "\r\n\x00") || isImageGenerationModel(model) {
		return fmt.Errorf("choose a supported text model")
	}
	for _, marker := range []string{"image", "video", "audio", "realtime", "embedding", "tts", "stt", "dall-e", "sora", "whisper", "speech"} {
		if strings.Contains(model, marker) || strings.Contains(mappedModel, marker) {
			return fmt.Errorf("diagnostic only supports text generation models")
		}
	}
	if opts.ImageDataURL != "" || opts.AudioDataURL != "" {
		return fmt.Errorf("diagnostic does not accept media")
	}
	return nil
}

func applyAccountDiagnosticPayload(c *gin.Context, payload map[string]any, protocol string, oauth bool) {
	if accountDiagnostic(c) == nil || payload == nil {
		return
	}
	switch protocol {
	case "anthropic":
		payload["messages"] = []map[string]any{{"role": "user", "content": []map[string]any{{"type": "text", "text": AccountDiagnosticPrompt}}}}
		payload["max_tokens"] = 128
		payload["temperature"] = 0
	case "responses":
		payload["input"] = []map[string]any{{"role": "user", "content": []map[string]any{{"type": "input_text", "text": AccountDiagnosticPrompt}}}}
		// Codex OAuth rejects max_output_tokens. It is still bounded by the
		// request timeout and streamed-output byte limit below.
		if !oauth {
			payload["max_output_tokens"] = 128
		}
	case "chat":
		payload["messages"] = []map[string]any{{"role": "user", "content": AccountDiagnosticPrompt}}
		payload["max_completion_tokens"] = 128
		payload["stream_options"] = map[string]any{"include_usage": true}
	case "gemini":
		payload["generationConfig"] = map[string]any{"maxOutputTokens": 128, "temperature": 0}
	}
}

func recordAccountDiagnosticUsage(c *gin.Context, data map[string]any, protocol string) {
	state := accountDiagnostic(c)
	if state == nil {
		return
	}
	var usage map[string]any
	key := "output_tokens"
	switch protocol {
	case "responses":
		if response, ok := data["response"].(map[string]any); ok {
			usage, _ = response["usage"].(map[string]any)
		}
	case "anthropic":
		usage, _ = data["usage"].(map[string]any)
	case "chat":
		usage, _ = data["usage"].(map[string]any)
		key = "completion_tokens"
	case "gemini":
		usage, _ = data["usageMetadata"].(map[string]any)
		key = "candidatesTokenCount"
	}
	value, ok := usage[key].(float64)
	if !ok || value < 0 || value > 1e9 || math.IsNaN(value) || math.IsInf(value, 0) || math.Trunc(value) != value {
		return
	}
	tokens := int64(value)
	state.outputTokens = &tokens
}

func decorateAccountDiagnosticEvent(c *gin.Context, event *TestEvent) bool {
	state := accountDiagnostic(c)
	if state == nil {
		return true
	}
	if state.ended {
		return false
	}
	now := time.Now()
	if event.Type == "content" && event.Text != "" {
		if state.firstContent == nil {
			state.firstContent = &now
		}
		state.outputBytes += len(event.Text)
		if state.outputBytes > accountDiagnosticMaxOutputBytes {
			event.Type = "error"
			event.Text = ""
			event.Error = "Diagnostic output exceeded the safe limit"
			if state.cancel != nil {
				state.cancel()
			}
		}
	}
	if event.Type == "error" || event.Type == "test_complete" {
		state.ended = true
		if event.Type == "error" {
			// Do not expose raw provider bodies, URLs, or credential errors in
			// this user-facing dashboard. Existing connectivity tests unchanged.
			event.Error = "Diagnostic failed; check the configured account and model"
			event.Success = false
		} else if state.firstContent == nil {
			event.Success = false
			event.Error = "Diagnostic completed without text output"
		}
		metrics := &AccountDiagnosticMetrics{RubricID: "json-arithmetic-v1", TotalMs: now.Sub(state.started).Milliseconds()}
		if state.firstContent != nil {
			firstMs := state.firstContent.Sub(state.started).Milliseconds()
			metrics.FirstTokenMs = &firstMs
		}
		if event.Success {
			metrics.OutputTokens = state.outputTokens
			if state.outputTokens != nil && state.firstContent != nil && *state.outputTokens > 0 {
				seconds := now.Sub(*state.firstContent).Seconds()
				if seconds >= 0.001 {
					rate := float64(*state.outputTokens) / seconds
					metrics.TokensPerSecond = &rate
				}
			}
		}
		event.Metrics = metrics
	}
	return true
}

// Bound all diagnostic wire bytes, including ignored SSE events, reasoning,
// newline-free frames and provider errors, before any unbounded parser reads.
const accountDiagnosticMaxWireBytes = 64 << 10

var errAccountDiagnosticWireLimit = errors.New("diagnostic response byte limit exceeded")

type accountDiagnosticBoundedBody struct {
	io.ReadCloser
	remaining int
	cancel    context.CancelFunc
}

func (b *accountDiagnosticBoundedBody) Read(p []byte) (int, error) {
	if b.remaining <= 0 {
		if b.cancel != nil {
			b.cancel()
		}
		return 0, errAccountDiagnosticWireLimit
	}
	if len(p) > b.remaining {
		p = p[:b.remaining]
	}
	n, err := b.ReadCloser.Read(p)
	b.remaining -= n
	return n, err
}
func boundAccountDiagnosticResponse(c *gin.Context, response *http.Response) {
	state := accountDiagnostic(c)
	if state == nil || response == nil || response.Body == nil {
		return
	}
	if _, bounded := response.Body.(*accountDiagnosticBoundedBody); bounded {
		return
	}
	response.Body = &accountDiagnosticBoundedBody{ReadCloser: response.Body, remaining: accountDiagnosticMaxWireBytes, cancel: state.cancel}
}
