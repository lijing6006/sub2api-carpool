//go:build carpoolpg && !integration

package repository

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	dbent "github.com/Wei-Shaw/sub2api/ent"
	_ "github.com/Wei-Shaw/sub2api/ent/runtime"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/Wei-Shaw/sub2api/migrations"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

// TestCarpoolPostgres is deliberately not part of the default/unit/integration
// suites. It only accepts an explicitly supplied private Unix socket and a fresh
// disposable database. It never uses DATABASE_URL, TCP, Docker, Redis or models.
// 中文：仅针对明确提供的私有本机 socket 和全新一次性数据库，不连接生产服务。
func TestCarpoolPostgres(t *testing.T) {
	db := openCarpoolPostgres(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	client := dbent.NewClient(dbent.Driver(entsql.OpenDB(dialect.Postgres, db)))
	users := NewUserRepository(client, db)
	billing := NewUsageBillingRepository(client, db)

	t.Run("migration_upgrade_preserves_ordinary_users", func(t *testing.T) {
		baseline := fstest.MapFS{}
		names, err := fs.Glob(migrations.FS, "*.sql")
		require.NoError(t, err)
		for _, name := range names {
			if name >= "249_" {
				continue
			}
			body, readErr := migrations.FS.ReadFile(name)
			require.NoError(t, readErr)
			baseline[name] = &fstest.MapFile{Data: body, Mode: 0o444}
		}
		require.Greater(t, len(baseline), 200)
		require.NoError(t, applyMigrationsFS(ctx, db, baseline))

		var legacyID int64
		require.NoError(t, db.QueryRowContext(ctx, `INSERT INTO users (email,password_hash,balance)
			VALUES ('carpool-preupgrade@example.invalid','non-authenticating-test-fixture',42) RETURNING id`).Scan(&legacyID))
		var oldBalance float64
		require.NoError(t, db.QueryRowContext(ctx, `SELECT balance FROM users WHERE id=$1`, legacyID).Scan(&oldBalance))
		require.Equal(t, 42.0, oldBalance)
		require.NoError(t, ApplyMigrations(ctx, db))

		legacy, err := users.GetByID(ctx, legacyID)
		require.NoError(t, err)
		require.Nil(t, legacy.TemporaryExpiresAt)
		require.Nil(t, legacy.TemporaryBudgetUSD)
		require.Zero(t, legacy.TemporarySpentUSD)
		require.Equal(t, 42.0, legacy.Balance)
		require.False(t, legacy.IsTemporary())
		// Old-column SQL and the current repository remain compatible after the
		// additive migration. This does not claim an old executable was run.
		_, err = db.ExecContext(ctx, `UPDATE users SET balance=balance+1 WHERE id=$1`, legacyID)
		require.NoError(t, err)
		require.NoError(t, users.UpdateBalance(ctx, legacyID, 2))
		legacy, err = users.GetByID(ctx, legacyID)
		require.NoError(t, err)
		require.Equal(t, 45.0, legacy.Balance)
		require.Zero(t, legacy.TemporarySpentUSD)

		// The real runner must skip an already recorded migration rather than
		// re-add its named constraints. Concurrent startup uses advisory locks.
		errs := make(chan error, 2)
		for i := 0; i < 2; i++ {
			go func() { errs <- ApplyMigrations(ctx, db) }()
		}
		for i := 0; i < 2; i++ {
			require.NoError(t, <-errs)
		}
		var applied int
		require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE filename='249_temporary_members.sql'`).Scan(&applied))
		require.Equal(t, 1, applied)
	})
	if t.Failed() {
		return // Later cases must not operate on a partially migrated schema.
	}

	t.Run("database_constraints_reject_invalid_policy", func(t *testing.T) {
		cases := []struct {
			name, role string
			expires    any
			budget     any
			spent      float64
		}{
			{"expiry_only", "user", time.Now().Add(time.Hour), nil, 0},
			{"budget_only", "user", nil, 1.0, 0},
			{"zero_budget", "user", time.Now().Add(time.Hour), 0.0, 0},
			{"negative_budget", "user", time.Now().Add(time.Hour), -1.0, 0},
			{"temporary_admin", "admin", time.Now().Add(time.Hour), 1.0, 0},
			{"negative_meter", "user", time.Now().Add(time.Hour), 1.0, -1},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				_, err := db.ExecContext(ctx, `INSERT INTO users
					(email,password_hash,role,temporary_expires_at,temporary_budget_usd,temporary_spent_usd)
					VALUES ($1,'non-authenticating-test-fixture',$2,$3,$4,$5)`,
					"invalid-"+tc.name+"@example.invalid", tc.role, tc.expires, tc.budget, tc.spent)
				var pgErr *pq.Error
				require.ErrorAs(t, err, &pgErr)
				require.Equal(t, pq.ErrorCode("23514"), pgErr.Code)
			})
		}
	})

	t.Run("balance_meter_and_duplicate_are_atomic", func(t *testing.T) {
		id := insertCarpoolTemporaryUser(t, ctx, db, "balance", 100, 100)
		key := insertCarpoolFixtureKey(t, ctx, db, id, "balance")
		cmd := service.UsageBillingCommand{RequestID: "carpool-balance", APIKeyID: key, UserID: id, BalanceCost: 1.25, TemporaryUserCost: 1.25}
		result, err := billing.Apply(ctx, &cmd)
		require.NoError(t, err)
		require.True(t, result.Applied)
		result, err = billing.Apply(ctx, &cmd)
		require.NoError(t, err)
		require.False(t, result.Applied)
		assertCarpoolMeter(t, ctx, db, id, 98.75, 1.25)

		conflict := service.UsageBillingCommand{RequestID: cmd.RequestID, APIKeyID: key, UserID: id, BalanceCost: 2, TemporaryUserCost: 2}
		_, err = billing.Apply(ctx, &conflict)
		require.ErrorIs(t, err, service.ErrUsageBillingRequestConflict)
		assertCarpoolMeter(t, ctx, db, id, 98.75, 1.25)
	})

	t.Run("concurrent_same_request_charges_once", func(t *testing.T) {
		id := insertCarpoolTemporaryUser(t, ctx, db, "duplicate-race", 100, 100)
		key := insertCarpoolFixtureKey(t, ctx, db, id, "duplicate-race")
		commands := make([]service.UsageBillingCommand, 16)
		for i := range commands {
			commands[i] = service.UsageBillingCommand{RequestID: "carpool-same-race", APIKeyID: key, UserID: id, BalanceCost: 0.75, TemporaryUserCost: 0.75}
		}
		require.Equal(t, 1, applyCarpoolConcurrently(t, ctx, billing, commands))
		assertCarpoolMeter(t, ctx, db, id, 99.25, 0.75)
		var claims int
		require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM usage_billing_dedup WHERE request_id=$1 AND api_key_id=$2`, commands[0].RequestID, key).Scan(&claims))
		require.Equal(t, 1, claims)
	})

	t.Run("concurrent_distinct_keys_keep_cumulative_soft_meter", func(t *testing.T) {
		id := insertCarpoolTemporaryUser(t, ctx, db, "distinct-race", 100, 0.1)
		commands := make([]service.UsageBillingCommand, 16)
		for i := range commands {
			label := fmt.Sprintf("distinct-%02d", i)
			key := insertCarpoolFixtureKey(t, ctx, db, id, label)
			commands[i] = service.UsageBillingCommand{RequestID: "carpool-" + label, APIKeyID: key, UserID: id, BalanceCost: 0.25, TemporaryUserCost: 0.25}
		}
		require.Equal(t, 16, applyCarpoolConcurrently(t, ctx, billing, commands))
		assertCarpoolMeter(t, ctx, db, id, 96, 4)
		user, err := users.GetByID(ctx, id)
		require.NoError(t, err)
		require.Greater(t, user.TemporarySpentUSD, *user.TemporaryBudgetUSD,
			"billing settles already-admitted work; this is a soft cap, not reservation")
		// Replenishment, extension and a higher budget do not erase prior usage.
		require.NoError(t, users.UpdateBalance(ctx, id, 10))
		later, larger := time.Now().Add(48*time.Hour), 20.0
		user.TemporaryExpiresAt, user.TemporaryBudgetUSD = &later, &larger
		require.NoError(t, users.Update(ctx, user, service.UserUpdateFields{TemporaryAccess: true}))
		assertCarpoolMeter(t, ctx, db, id, 106, 4)
	})

	t.Run("subscription_and_temporary_meter_share_transaction", func(t *testing.T) {
		id := insertCarpoolTemporaryUser(t, ctx, db, "subscription", 100, 100)
		key := insertCarpoolFixtureKey(t, ctx, db, id, "subscription")
		subscription := insertCarpoolSubscription(t, ctx, db, id, "subscription")
		cmd := service.UsageBillingCommand{RequestID: "carpool-subscription", APIKeyID: key, UserID: id, SubscriptionID: &subscription, SubscriptionCost: 2.5, TemporaryUserCost: 2.5}
		result, err := billing.Apply(ctx, &cmd)
		require.NoError(t, err)
		require.True(t, result.Applied)
		result, err = billing.Apply(ctx, &cmd)
		require.NoError(t, err)
		require.False(t, result.Applied)
		assertCarpoolMeter(t, ctx, db, id, 100, 2.5)
		var daily, weekly, monthly float64
		require.NoError(t, db.QueryRowContext(ctx, `SELECT daily_usage_usd,weekly_usage_usd,monthly_usage_usd FROM user_subscriptions WHERE id=$1`, subscription).Scan(&daily, &weekly, &monthly))
		require.Equal(t, 2.5, daily)
		require.Equal(t, daily, weekly)
		require.Equal(t, daily, monthly)
	})

	t.Run("failed_settlement_rolls_back_meter_and_claim", func(t *testing.T) {
		id := insertCarpoolTemporaryUser(t, ctx, db, "rollback", 100, 100)
		key := insertCarpoolFixtureKey(t, ctx, db, id, "rollback")
		missing := int64(-1)
		cmd := service.UsageBillingCommand{RequestID: "carpool-rollback", APIKeyID: key, UserID: id, SubscriptionID: &missing, SubscriptionCost: 1.5, TemporaryUserCost: 1.5}
		_, err := billing.Apply(ctx, &cmd)
		require.ErrorIs(t, err, service.ErrSubscriptionNotFound)
		assertCarpoolMeter(t, ctx, db, id, 100, 0)
		var claims int
		require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM usage_billing_dedup WHERE request_id=$1 AND api_key_id=$2`, cmd.RequestID, key).Scan(&claims))
		require.Zero(t, claims)
		// A corrected retry can now settle exactly once, because the failed
		// transaction did not retain either its claim or temporary increment.
		subscription := insertCarpoolSubscription(t, ctx, db, id, "rollback")
		cmd.SubscriptionID, cmd.RequestFingerprint = &subscription, ""
		result, err := billing.Apply(ctx, &cmd)
		require.NoError(t, err)
		require.True(t, result.Applied)
		assertCarpoolMeter(t, ctx, db, id, 100, 1.5)
	})
}

func openCarpoolPostgres(t *testing.T) *sql.DB {
	t.Helper()
	socket := os.Getenv("CARPOOL_TEST_PG_SOCKET")
	if socket == "" {
		t.Skip("set CARPOOL_TEST_PG_SOCKET to an isolated private Unix socket to opt in")
	}
	require.True(t, filepath.IsAbs(socket), "only an absolute Unix-socket directory is permitted")
	require.True(t, strings.HasPrefix(filepath.Base(socket), "sub2api-carpool-pg-"), "socket directory must be explicitly test-scoped")
	resolved, err := filepath.EvalSymlinks(socket)
	require.NoError(t, err)
	require.Equal(t, filepath.Clean(socket), resolved, "symlinked socket directories are not permitted")
	info, err := os.Stat(socket)
	require.NoError(t, err)
	require.True(t, info.IsDir())
	require.Equal(t, os.FileMode(0o700), info.Mode().Perm(), "test socket directory must be private")
	port := 5432
	if raw := os.Getenv("CARPOOL_TEST_PG_PORT"); raw != "" {
		port, err = strconv.Atoi(raw)
		require.NoError(t, err)
		require.GreaterOrEqual(t, port, 1024)
		require.LessOrEqual(t, port, 65535)
	}
	params := url.Values{"host": {socket}, "port": {strconv.Itoa(port)}, "sslmode": {"disable"}, "connect_timeout": {"3"}, "TimeZone": {"UTC"}, "application_name": {"carpool-isolated-regression"}}
	u := url.URL{Scheme: "postgres", User: url.User("carpool_test"), Path: "/carpool_validation", RawQuery: params.Encode()}
	dsn, err := pq.ParseURL(u.String())
	require.NoError(t, err)
	// ParseURL drops empty passwords. An explicit keyword prevents inheriting
	// PGPASSWORD or reading .pgpass; this private fixture never uses real secrets.
	db, err := sql.Open("postgres", dsn+" password='' options=''")
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(20)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	require.NoError(t, db.PingContext(ctx))
	var database, user string
	var serverAddress sql.NullString
	require.NoError(t, db.QueryRowContext(ctx, `SELECT current_database(),current_user,inet_server_addr()::text`).Scan(&database, &user, &serverAddress))
	require.Equal(t, "carpool_validation", database)
	require.Equal(t, "carpool_test", user)
	require.False(t, serverAddress.Valid, "TCP connections are forbidden")
	var existing int
	require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')`).Scan(&existing))
	require.Zero(t, existing, "refusing to modify a preexisting schema; use a fresh disposable database")
	return db
}

func insertCarpoolTemporaryUser(t *testing.T, ctx context.Context, db *sql.DB, label string, balance, budget float64) int64 {
	t.Helper()
	var id int64
	require.NoError(t, db.QueryRowContext(ctx, `INSERT INTO users (email,password_hash,balance,temporary_expires_at,temporary_budget_usd)
		VALUES ($1,'non-authenticating-test-fixture',$2,NOW()+INTERVAL '1 day',$3) RETURNING id`, "carpool-"+label+"@example.invalid", balance, budget).Scan(&id))
	return id
}

func insertCarpoolFixtureKey(t *testing.T, ctx context.Context, db *sql.DB, userID int64, label string) int64 {
	t.Helper()
	var id int64
	// Deliberately synthetic values in an isolated DB, not generated API secrets.
	require.NoError(t, db.QueryRowContext(ctx, `INSERT INTO api_keys (user_id,key,name) VALUES ($1,$2,$3) RETURNING id`, userID, "non-authenticating-fixture-"+label, "carpool-fixture-"+label).Scan(&id))
	return id
}

func insertCarpoolSubscription(t *testing.T, ctx context.Context, db *sql.DB, userID int64, label string) int64 {
	t.Helper()
	var group, subscription int64
	require.NoError(t, db.QueryRowContext(ctx, `INSERT INTO groups (name,subscription_type) VALUES ($1,'subscription') RETURNING id`, "carpool-fixture-"+label).Scan(&group))
	require.NoError(t, db.QueryRowContext(ctx, `INSERT INTO user_subscriptions (user_id,group_id,starts_at,expires_at) VALUES ($1,$2,NOW(),NOW()+INTERVAL '1 day') RETURNING id`, userID, group).Scan(&subscription))
	return subscription
}

func assertCarpoolMeter(t *testing.T, ctx context.Context, db *sql.DB, userID int64, balance, spent float64) {
	t.Helper()
	var gotBalance, gotSpent float64
	require.NoError(t, db.QueryRowContext(ctx, `SELECT balance,temporary_spent_usd FROM users WHERE id=$1`, userID).Scan(&gotBalance, &gotSpent))
	require.InDelta(t, balance, gotBalance, 1e-9)
	require.InDelta(t, spent, gotSpent, 1e-9)
}

func applyCarpoolConcurrently(t *testing.T, ctx context.Context, repo service.UsageBillingRepository, commands []service.UsageBillingCommand) int {
	t.Helper()
	type outcome struct {
		applied bool
		err     error
	}
	results := make(chan outcome, len(commands))
	start := make(chan struct{})
	var ready sync.WaitGroup
	ready.Add(len(commands))
	for _, command := range commands {
		go func(cmd service.UsageBillingCommand) {
			ready.Done()
			<-start
			result, err := repo.Apply(ctx, &cmd) // Each goroutine owns its mutable Normalize input.
			results <- outcome{applied: result != nil && result.Applied, err: err}
		}(command)
	}
	ready.Wait()
	close(start)
	applied := 0
	var firstError error
	for range commands {
		result := <-results
		if result.err != nil && firstError == nil {
			firstError = result.err
		}
		if result.applied {
			applied++
		}
	}
	require.NoError(t, firstError)
	return applied
}
