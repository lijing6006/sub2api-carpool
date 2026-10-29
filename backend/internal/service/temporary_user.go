package service

import (
	"context"
	"math"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

var (
	ErrTemporaryUserExpired     = infraerrors.Forbidden("TEMPORARY_USER_EXPIRED", "Temporary member access has expired")
	ErrTemporaryUserBudget      = infraerrors.TooManyRequests("TEMPORARY_USER_BUDGET_EXHAUSTED", "Temporary member spending limit has been reached")
	ErrTemporaryUserUnavailable = infraerrors.ServiceUnavailable("TEMPORARY_USER_POLICY_UNAVAILABLE", "Unable to verify temporary member limits; retry later")
)

func validateTemporaryUserInput(expires *time.Time, budget *float64, role string, now time.Time) error {
	if expires == nil && budget == nil {
		return nil
	}
	if expires == nil || budget == nil {
		return infraerrors.BadRequest("TEMPORARY_USER_LIMITS_REQUIRED", "Temporary members require both an expiry time and a spending limit")
	}
	if role != "" && role != RoleUser {
		return infraerrors.BadRequest("TEMPORARY_ADMIN_FORBIDDEN", "Temporary members cannot be administrators")
	}
	if !expires.After(now) || expires.After(now.AddDate(1, 0, 0)) {
		return infraerrors.BadRequest("TEMPORARY_USER_EXPIRY_INVALID", "Expiry must be in the future and within one year")
	}
	if math.IsNaN(*budget) || math.IsInf(*budget, 0) || *budget < 0.00000001 || *budget > 1000000 {
		return infraerrors.BadRequest("TEMPORARY_USER_BUDGET_INVALID", "Spending limit must be positive and no greater than 1000000 USD")
	}
	return nil
}

// RefreshTemporaryUser never trusts cached budget usage. Ordinary users keep
// the existing cache-only fast path; temporary accounts use the database as
// their source of truth on every gateway request and fail closed on read error.
func (s *APIKeyService) RefreshTemporaryUser(ctx context.Context, user *User) (*User, error) {
	if user == nil || !user.IsTemporary() {
		return user, nil
	}
	if s == nil || s.userRepo == nil {
		return nil, ErrTemporaryUserUnavailable
	}
	fresh, err := s.userRepo.GetByID(ctx, user.ID)
	if err != nil || fresh == nil || fresh.TemporaryExpiresAt == nil || fresh.TemporaryBudgetUSD == nil {
		return nil, ErrTemporaryUserUnavailable
	}
	if fresh.IsTemporaryExpired(time.Now()) {
		return nil, ErrTemporaryUserExpired
	}
	// Keep the per-key group override when replacing the user snapshot.
	fresh.UserGroupRPMOverride = user.UserGroupRPMOverride
	return fresh, nil
}
