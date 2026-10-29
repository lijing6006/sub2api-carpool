//go:build unit

package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestTemporaryBillingMeterAtomicWithBalance(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()
	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)
	mock.ExpectExec("UPDATE users SET temporary_spent_usd = temporary_spent_usd \\+ \\$1").WithArgs(2.0, int64(8)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(conditionalBalanceDeductSQL).WithArgs(2.0, int64(8)).WillReturnRows(sqlmock.NewRows([]string{"balance"}).AddRow(8))
	mock.ExpectCommit()
	err = (&usageBillingRepository{db: db}).applyUsageBillingEffects(context.Background(), tx, &service.UsageBillingCommand{UserID: 8, TemporaryUserCost: 2, BalanceCost: 2}, &service.UsageBillingApplyResult{})
	require.NoError(t, err)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestTemporaryBillingMeterFailureRollsBack(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()
	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)
	mock.ExpectExec("UPDATE users SET temporary_spent_usd").WillReturnError(errors.New("meter unavailable"))
	mock.ExpectRollback()
	err = (&usageBillingRepository{db: db}).applyUsageBillingEffects(context.Background(), tx, &service.UsageBillingCommand{UserID: 8, TemporaryUserCost: 2, BalanceCost: 2}, &service.UsageBillingApplyResult{})
	require.Error(t, err)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestTemporaryBillingDuplicateDoesNotIncrementAgain(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()
	cmd := &service.UsageBillingCommand{RequestID: "same", APIKeyID: 2, UserID: 8, TemporaryUserCost: 2}
	cmd.Normalize()
	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO usage_billing_dedup").WithArgs(cmd.RequestID, cmd.APIKeyID, cmd.RequestFingerprint).WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery("SELECT request_fingerprint.*FROM usage_billing_dedup").WithArgs(cmd.RequestID, cmd.APIKeyID).WillReturnRows(sqlmock.NewRows([]string{"request_fingerprint"}).AddRow(cmd.RequestFingerprint))
	mock.ExpectRollback()
	result, err := (&usageBillingRepository{db: db}).Apply(context.Background(), cmd)
	require.NoError(t, err)
	require.False(t, result.Applied)
	require.NoError(t, mock.ExpectationsWereMet())
}
