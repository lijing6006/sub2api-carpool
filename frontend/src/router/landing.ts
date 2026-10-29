/** Role-aware default destination. Explicit deep links are never rewritten. */
export function resolveDashboardPath(isAdmin: boolean, isSimpleMode = false): string {
  if (!isAdmin) return '/dashboard'
  return isSimpleMode ? '/admin/dashboard' : '/admin/carpool'
}

export const AUTHENTICATED_LANDING_PATH = '/workspace'
