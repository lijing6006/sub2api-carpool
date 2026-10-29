import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

interface Route { path: string; meta: Record<string, unknown>; redirect?: string }
interface Destination extends Route { fullPath: string; name: string; params: Record<string, unknown> }
type Guard = (to: Destination, from: object, next: (value?: unknown) => void) => Promise<void>
const harness = vi.hoisted(() => ({ guard: null as Guard | null, routes: [] as Route[] }))
const app = vi.hoisted(() => ({ siteName: 'Test', backendModeEnabled: false, publicSettingsLoaded: true, cachedPublicSettings: {} }))
const auth = vi.hoisted(() => ({ checkAuth: vi.fn(), isAuthenticated: true, isAdmin: true, isSimpleMode: false, hasPendingAuthSession: false }))
vi.mock('vue-router', () => ({
  createWebHistory: () => ({}),
  createRouter: (options: { routes: Route[] }) => {
    harness.routes = options.routes
    return { beforeEach: (guard: Guard) => { harness.guard = guard }, afterEach: vi.fn(), onError: vi.fn() }
  }
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/app', () => ({ useAppStore: () => app }))
vi.mock('@/stores/adminSettings', () => ({ useAdminSettingsStore: () => ({ customMenuItems: [] }) }))
vi.mock('@/stores/adminCompliance', () => ({ useAdminComplianceStore: () => ({ initialized: true }) }))
vi.mock('@/composables/useNavigationLoading', () => ({ useNavigationLoadingState: () => ({ startNavigation: vi.fn(), endNavigation: vi.fn() }) }))
vi.mock('@/composables/useRoutePrefetch', () => ({ useRoutePrefetch: () => ({ triggerPrefetch: vi.fn() }) }))
vi.mock('@/api/setup', () => ({ getSetupStatus: vi.fn() }))
vi.mock('@/router/title', () => ({ resolveRouteDocumentTitle: () => 'Carpool' }))

async function navigate(path = '/admin/carpool', suffix = '?tab=diagnostics') {
  const route = harness.routes.find(item => item.path === path)!
  const next = vi.fn()
  await harness.guard!({ ...route, fullPath: path + suffix, name: 'AdminCarpool', params: {} }, {}, next)
  return next
}

describe('actual carpool route guard', () => {
  beforeAll(async () => { await import('@/router') })
  beforeEach(() => { auth.isAuthenticated = true; auth.isAdmin = true; auth.isSimpleMode = false; app.backendModeEnabled = false })
  it('opens the carpool workspace from the admin root', () => {
    expect(harness.routes.find(route => route.path === '/admin')?.redirect).toBe('/admin/carpool')
  })
  it('resolves neutral login and OAuth defaults after authentication', async () => {
    expect(await navigate('/workspace', '')).toHaveBeenCalledWith('/admin/carpool')
    auth.isSimpleMode = true
    expect(await navigate('/workspace', '')).toHaveBeenCalledWith('/admin/dashboard')
    auth.isAdmin = false
    expect(await navigate('/workspace', '')).toHaveBeenCalledWith('/dashboard')
  })
  it('preserves explicit personal and system-dashboard destinations', async () => {
    expect(await navigate('/dashboard', '')).toHaveBeenCalledWith()
    expect(await navigate('/admin/dashboard', '')).toHaveBeenCalledWith()
  })
  it('uses the carpool landing for already authenticated login visits', async () => {
    expect(await navigate('/login', '')).toHaveBeenCalledWith('/admin/carpool')
  })
  it('does not loop backend-only members through the landing page', async () => {
    app.backendModeEnabled = true
    auth.isAdmin = false
    expect(await navigate('/workspace', '')).toHaveBeenCalledWith('/login')
  })
  it('keeps anonymous neutral landing behind authentication', async () => {
    auth.isAuthenticated = false
    expect(await navigate('/workspace', '')).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/workspace' } })
  })
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
