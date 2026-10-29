import { resolveDashboardPath } from './landing'

export function resolveCompletedSetupRedirectPath(isAuthenticated: boolean, isAdmin: boolean, isSimpleMode = false): string {
  if (!isAuthenticated) {
    return '/login'
  }

  return resolveDashboardPath(isAdmin, isSimpleMode)
}
