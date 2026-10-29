import { describe, expect, it } from 'vitest'
import { AUTHENTICATED_LANDING_PATH, resolveDashboardPath } from '../landing'
import { resolveCompletedSetupRedirectPath } from '../setupRedirect'

describe('role-aware default workspace', () => {
  it('has a neutral post-authentication landing route', () => {
    expect(AUTHENTICATED_LANDING_PATH).toBe('/workspace')
  })
  it('prioritizes carpool only for standard-mode administrators', () => {
    expect(resolveDashboardPath(true, false)).toBe('/admin/carpool')
    expect(resolveDashboardPath(true, true)).toBe('/admin/dashboard')
    expect(resolveDashboardPath(false, false)).toBe('/dashboard')
    expect(resolveDashboardPath(false, true)).toBe('/dashboard')
  })
  it('keeps setup authentication and simple-mode restrictions intact', () => {
    expect(resolveCompletedSetupRedirectPath(false, true)).toBe('/login')
    expect(resolveCompletedSetupRedirectPath(true, true)).toBe('/admin/carpool')
    expect(resolveCompletedSetupRedirectPath(true, true, true)).toBe('/admin/dashboard')
    expect(resolveCompletedSetupRedirectPath(true, false)).toBe('/dashboard')
  })
})
