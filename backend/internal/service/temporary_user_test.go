//go:build unit

package service

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

func TestTemporaryUserValidation(t *testing.T) {
	now := time.Now()
	future := now.Add(24 * time.Hour)
	past := now.Add(-time.Second)
	tooLate := now.AddDate(2, 0, 0)
	budget := 10.0
	require.NoError(t, validateTemporaryUserInput(nil, nil, "", now))
	require.NoError(t, validateTemporaryUserInput(&future, &budget, RoleUser, now))
	for _, tc := range []struct {
		name    string
		expires *time.Time
		budget  *float64
		role    string
	}{
		{"missing expiry", nil, &budget, RoleUser}, {"missing budget", &future, nil, RoleUser}, {"expired", &past, &budget, RoleUser}, {"too far", &tooLate, &budget, RoleUser}, {"administrator", &future, &budget, RoleAdmin},
	} {
		t.Run(tc.name, func(t *testing.T) { require.Error(t, validateTemporaryUserInput(tc.expires, tc.budget, tc.role, now)) })
	}
	for _, value := range []float64{0, -1, math.NaN(), math.Inf(1), 1000001} {
		require.Error(t, validateTemporaryUserInput(&future, &value, RoleUser, now))
	}
}

func TestTemporaryUserExpiryAndSpendingAreIndependentOfBalance(t *testing.T) {
	now := time.Now()
	expires := now.Add(time.Hour)
	budget := 10.0
	user := &User{Status: StatusActive, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget, TemporarySpentUSD: 10, Balance: 10000}
	require.True(t, user.IsActive(), "exhausted members can still read their dashboard until expiry")
	require.True(t, user.IsTemporaryBudgetExhausted(), "top-ups must not reset spending")
	require.True(t, user.IsTemporaryExpired(expires), "expiry is inclusive")
	expires = now.Add(-time.Second)
	require.False(t, user.IsActive())
}

func TestTemporaryUserRefreshReadsAuthoritativeUsageAndFailsClosed(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	cached := &User{ID: 4, Status: StatusActive, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}
	fresh := *cached
	fresh.TemporarySpentUSD = 11
	repo := &userRepoStub{user: &fresh}
	svc := &APIKeyService{userRepo: repo}
	got, err := svc.RefreshTemporaryUser(context.Background(), cached)
	require.NoError(t, err)
	require.True(t, got.IsTemporaryBudgetExhausted())
	repo.getErr = errors.New("db down")
	_, err = svc.RefreshTemporaryUser(context.Background(), cached)
	require.ErrorIs(t, err, ErrTemporaryUserUnavailable)
	repo.getErr = nil
	expired := time.Now().Add(-time.Second)
	fresh.TemporaryExpiresAt = &expired
	_, err = svc.RefreshTemporaryUser(context.Background(), cached)
	require.ErrorIs(t, err, ErrTemporaryUserExpired)
	ordinary := &User{ID: 7}
	got, err = svc.RefreshTemporaryUser(context.Background(), ordinary)
	require.NoError(t, err)
	require.Same(t, ordinary, got)
}

func TestTemporaryUserCreateAndRoleEscalationGuard(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	repo := &userRepoStub{nextID: 5}
	svc := &adminServiceImpl{userRepo: repo}
	user, err := svc.CreateUser(context.Background(), &CreateUserInput{Email: "temporary@example.test", Password: "long-password-123", TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget})
	require.NoError(t, err)
	require.True(t, user.IsTemporary())
	require.Zero(t, user.TemporarySpentUSD)
	_, err = svc.UpdateUser(context.Background(), user.ID, &UpdateUserInput{Role: RoleAdmin})
	require.Error(t, err)
	_, err = svc.CreateUser(context.Background(), &CreateUserInput{Email: "short@example.test", Password: "short", TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget})
	require.Error(t, err)
	repo.user = &User{ID: 8, Role: RoleUser, Status: StatusActive}
	_, err = svc.UpdateUser(context.Background(), 8, &UpdateUserInput{TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget})
	require.Error(t, err, "existing accounts cannot be converted while async tasks may be outstanding")
}

func TestTemporaryUserBillingCountsBalanceAndSubscriptions(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	for _, subscription := range []bool{false, true} {
		p := &postUsageBillingParams{Cost: &CostBreakdown{TotalCost: 1, ActualCost: 2}, User: &User{ID: 1, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}, APIKey: &APIKey{ID: 2}, Account: &Account{ID: 3}, Subscription: &UserSubscription{ID: 4}, IsSubscriptionBill: subscription}
		cmd := buildUsageBillingCommand("temporary-test", nil, p)
		require.Equal(t, 2.0, cmd.TemporaryUserCost)
		if subscription {
			require.Equal(t, 2.0, cmd.SubscriptionCost)
		} else {
			require.Equal(t, 2.0, cmd.BalanceCost)
		}
	}
}

func TestTemporaryUserExpiredTokenCannotBeRefreshed(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	user := &User{ID: 1, Email: "temporary@example.test", Role: RoleUser, Status: StatusActive, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}
	cfg := &config.Config{}
	cfg.JWT.Secret = "temporary-test-secret-with-32-bytes"
	cfg.JWT.AccessTokenExpireMinutes = 60
	svc := NewAuthService(nil, &userRepoStub{user: user}, nil, nil, cfg, nil, nil, nil, nil, nil, nil, nil, nil)
	token, err := svc.GenerateToken(context.Background(), user)
	require.NoError(t, err)
	expired := time.Now().Add(-time.Second)
	user.TemporaryExpiresAt = &expired
	_, err = svc.RefreshToken(context.Background(), token)
	require.ErrorIs(t, err, ErrUserNotActive)
}

func TestTemporaryUserBillingNeverUsesNonIdempotentFallback(t *testing.T) {
	expires := time.Now().Add(time.Hour)
	budget := 10.0
	p := &postUsageBillingParams{Cost: &CostBreakdown{ActualCost: 2}, User: &User{ID: 1, TemporaryExpiresAt: &expires, TemporaryBudgetUSD: &budget}, APIKey: &APIKey{ID: 2}, Account: &Account{ID: 3}}
	applied, err := applyUsageBilling(context.Background(), "temporary-test", nil, p, &billingDeps{}, nil)
	require.False(t, applied)
	require.ErrorIs(t, err, ErrTemporaryUserUnavailable)
}
