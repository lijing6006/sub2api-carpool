package service

import (
	"context"
	"time"
)

type temporaryUserExpiryContextKey struct{}

type temporaryUserExpiryPolicy struct {
	ctx context.Context
}

// WithTemporaryUserExpiry binds a policy deadline independently of client
// cancellation. Gateway streams deliberately detach client cancellation so
// they can finish accounting, but must never detach the member's access expiry.
// The caller owns cancel for the entire handler lifetime, including stream drain.
func WithTemporaryUserExpiry(ctx context.Context, expires time.Time) (context.Context, context.CancelFunc) {
	policy, cancelPolicy := context.WithDeadline(context.Background(), expires)
	request, cancelRequest := context.WithDeadline(ctx, expires)
	request = context.WithValue(request, temporaryUserExpiryContextKey{}, temporaryUserExpiryPolicy{ctx: policy})
	return request, func() {
		cancelRequest()
		cancelPolicy()
	}
}

// temporaryExpiryUpstreamContext shares the request-owned policy timer rather
// than allocating a timer in each detach helper. Existing callers release those
// helpers immediately after constructing a request; their release must remain
// a no-op, not prematurely cancel the HTTP request before it is sent.
type temporaryExpiryUpstreamContext struct {
	context.Context
	policy context.Context
}

func (c temporaryExpiryUpstreamContext) Deadline() (time.Time, bool) { return c.policy.Deadline() }
func (c temporaryExpiryUpstreamContext) Done() <-chan struct{}       { return c.policy.Done() }
func (c temporaryExpiryUpstreamContext) Err() error                  { return c.policy.Err() }

func detachClientCancellation(ctx context.Context) context.Context {
	detached := context.WithoutCancel(ctx)
	if policy, ok := ctx.Value(temporaryUserExpiryContextKey{}).(temporaryUserExpiryPolicy); ok && policy.ctx != nil {
		return temporaryExpiryUpstreamContext{Context: detached, policy: policy.ctx}
	}
	return detached
}

// Settling usage must survive access expiry as well as client disconnect. Mask
// the policy marker so any further detachment within billing cannot reapply it.
func withoutTemporaryUserExpiry(ctx context.Context) context.Context {
	if _, ok := ctx.Value(temporaryUserExpiryContextKey{}).(temporaryUserExpiryPolicy); ok {
		return context.WithValue(ctx, temporaryUserExpiryContextKey{}, temporaryUserExpiryPolicy{})
	}
	return ctx
}

func temporaryUserExpiryReached(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	policy, ok := ctx.Value(temporaryUserExpiryContextKey{}).(temporaryUserExpiryPolicy)
	if !ok || policy.ctx == nil {
		return false
	}
	// The request and independent policy timer can fire in either order.
	// Compare the authoritative expiry rather than racing their Err values.
	expires, ok := policy.ctx.Deadline()
	return ok && !time.Now().Before(expires)
}
