-- Temporary-member limits are independent of balance and subscriptions.
-- The meter is cumulative and survives usage-log cleanup and balance top-ups.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS temporary_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS temporary_budget_usd NUMERIC(20,8),
    ADD COLUMN IF NOT EXISTS temporary_spent_usd NUMERIC(20,8) NOT NULL DEFAULT 0;

ALTER TABLE users ADD CONSTRAINT users_temporary_access_valid CHECK (
    (temporary_expires_at IS NULL AND temporary_budget_usd IS NULL)
    OR (temporary_expires_at IS NOT NULL AND temporary_budget_usd IS NOT NULL AND temporary_budget_usd > 0 AND role = 'user')
);

ALTER TABLE users ADD CONSTRAINT users_temporary_spent_nonnegative CHECK (temporary_spent_usd >= 0);
