import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

interface Route { path: string; meta: Record<string, unknown> }
interface Destination extends Route { fullPath: string; name: string; params: Record<string, unknown> }
type Guard = (to: Destination, from: object, next: (value?: unknown) => void) => Promise<void>
const harness = vi.hoisted(() => ({ guard: null as Guard | null, routes: [] as Route[] }))
const auth = vi.hoisted(() => ({ checkAuth: vi.fn(), isAuthenticated: true, isAdmin: true, isSimpleMode: false, hasPendingAuthSession: false }))
vi.mock('vue-router', () => ({
  createWebHistory: () => ({}),
  createRouter: (options: { routes: Route[] }) => {
    harness.routes = options.routes
    return { beforeEach: (guard: Guard) => { harness.guard = guard }, afterEach: vi.fn(), onError: vi.fn() }
  }
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ siteName: 'Test', backendModeEnabled: false, publicSettingsLoaded: true, cachedPublicSettings: {} }) }))
vi.mock('@/stores/adminSettings', () => ({ useAdminSettingsStore: () => ({ customMenuItems: [] }) }))
vi.mock('@/stores/adminCompliance', () => ({ useAdminComplianceStore: () => ({ initialized: true }) }))
vi.mock('@/composables/useNavigationLoading', () => ({ useNavigationLoadingState: () => ({ startNavigation: vi.fn(), endNavigation: vi.fn() }) }))
vi.mock('@/composables/useRoutePrefetch', () => ({ useRoutePrefetch: () => ({ triggerPrefetch: vi.fn() }) }))
vi.mock('@/api/setup', () => ({ getSetupStatus: vi.fn() }))
vi.mock('@/router/title', () => ({ resolveRouteDocumentTitle: () => 'Carpool' }))

async function navigate() {
  const route = harness.routes.find(item => item.path === '/admin/carpool')!
  const next = vi.fn()
  await harness.guard!({ ...route, fullPath: '/admin/carpool?tab=diagnostics', name: 'AdminCarpool', params: {} }, {}, next)
  return next
}

describe('actual carpool route guard', () => {
  beforeAll(async () => { await import('@/router') })
  beforeEach(() => { auth.isAuthenticated = true; auth.isAdmin = true; auth.isSimpleMode = false })
  it('registers explicit authentication and administrator requirements', () => {
    expect(harness.routes.find(route => route.path === '/admin/carpool')?.meta).toMatchObject({ requiresAuth: true, requiresAdmin: true })
  })
  it('redirects an anonymous deep link to login', async () => {
    auth.isAuthenticated = false
    expect(await navigate()).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/admin/carpool?tab=diagnostics' } })
  })
  it('rejects ordinary members before loading cross-member data', async () => {
    auth.isAdmin = false
    expect(await navigate()).toHaveBeenCalledWith('/dashboard')
  })
  it('allows a standard-mode administrator', async () => {
    expect(await navigate()).toHaveBeenCalledWith()
  })
  it('does not expose subscription and temporary-account controls in unbilled simple mode', async () => {
    auth.isSimpleMode = true
    expect(await navigate()).toHaveBeenCalledWith('/admin/dashboard')
  })
})
