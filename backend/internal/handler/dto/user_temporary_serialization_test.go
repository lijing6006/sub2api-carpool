package dto

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestUserTemporarySerializationPreservesOrdinaryContract(t *testing.T) {
	ordinary := &service.User{ID: 1, Email: "ordinary@example.test", TemporarySpentUSD: 7}
	for name, mapped := range map[string]any{"shallow": UserFromServiceShallow(ordinary), "full": UserFromService(ordinary), "admin": UserFromServiceAdmin(ordinary)} {
		t.Run(name, func(t *testing.T) {
			data, err := json.Marshal(mapped)
			require.NoError(t, err)
			var object map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(data, &object))
			for _, key := range []string{"temporary_expires_at", "temporary_budget_usd", "temporary_spent_usd"} {
				require.NotContains(t, object, key, "ordinary user DTO must not gain temporary fields")
			}
		})
	}
}

func TestUserTemporarySerializationIncludesZeroAndNonzeroSpending(t *testing.T) {
	expires := time.Date(2027, 1, 2, 3, 4, 5, 0, time.UTC)
	budget := 10.0
	for _, spent := range []float64{0, 2.5} {
		member := &service.User{ID: 2, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget, TemporarySpentUSD: spent}
		for name, mapped := range map[string]any{"shallow": UserFromServiceShallow(member), "full": UserFromService(member), "admin": UserFromServiceAdmin(member)} {
			t.Run(name, func(t *testing.T) {
				data, err := json.Marshal(mapped)
				require.NoError(t, err)
				var object map[string]any
				require.NoError(t, json.Unmarshal(data, &object))
				require.Equal(t, expires.Format(time.RFC3339), object["temporary_expires_at"])
				require.Equal(t, budget, object["temporary_budget_usd"])
				require.Contains(t, object, "temporary_spent_usd", "zero usage must remain explicit for temporary users")
				require.Equal(t, spent, object["temporary_spent_usd"])
			})
		}
	}
}
