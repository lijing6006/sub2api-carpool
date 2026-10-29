package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAccountDiagnosticRequiresCostConsentAndValidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, body := range []string{`{"mode":"diagnostic","model_id":"gpt-5.4"}`, `{"mode":"diagnostic","confirm_cost":false}`, `{"mode":"diagnostic",`} {
		router := gin.New()
		// No service: reaching an upstream call would panic and fail this test.
		handler := &AccountHandler{}
		router.POST("/accounts/:id/test", handler.Test)
		request := httptest.NewRequest(http.MethodPost, "/accounts/1/test", strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusBadRequest, recorder.Code)
	}
}
