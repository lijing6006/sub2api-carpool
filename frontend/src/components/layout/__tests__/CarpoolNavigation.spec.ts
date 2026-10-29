import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '../AppSidebar.vue'

const state = vi.hoisted(() => ({
  auth: { isAdmin: true, isSimpleMode: false },
  route: { path: '/admin/carpool', query: {} as Record<string, string | string[]> },
  app: {
    sidebarCollapsed: false, mobileOpen: false, sidebarScrollTop: 0,
    siteName: 'Sub2API', siteLogo: '', siteVersion: '0.2.18', publicSettingsLoaded: true,
    cachedPublicSettings: {}, backendModeEnabled: false,
    toggleSidebar: vi.fn(), setMobileOpen: vi.fn()
  }
}))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores', () => ({
  useAuthStore: () => state.auth,
  useAppStore: () => state.app,
  useAdminSettingsStore: () => ({ customMenuItems: [], fetch: vi.fn(), opsMonitoringEnabled: true, paymentEnabled: true }),
  useOnboardingStore: () => ({ isCurrentStep: () => false })
}))
vi.mock('@/utils/featureFlags', () => ({ FeatureFlags: {}, makeSidebarFlag: () => () => true, resolveFeatureFlag: () => true }))
vi.mock('@/composables/useBatchImageAccess', () => ({ useBatchImageAccess: () => ({ canUseBatchImage: { value: false }, refreshBatchImageAccess: vi.fn() }) }))
vi.mock('@/components/common/VersionBadge.vue', () => ({ default: { template: '<span>runtime-version</span>' } }))

const render = () => mount(AppSidebar, { global: { stubs: { RouterLink: RouterLinkStub, Icon: true } } })

describe('rendered carpool sidebar navigation', () => {
  beforeEach(() => {
    state.auth.isAdmin = true
    state.auth.isSimpleMode = false
    state.route.path = '/admin/carpool'
    state.route.query = {}
    state.app.sidebarCollapsed = false
  })
  it('puts four named workspace areas above platform controls and retains system overview', () => {
    const wrapper = render()
    const navigation = wrapper.get('[data-testid="carpool-navigation"]')
    const links = navigation.findAllComponents(RouterLinkStub)
    expect(links.map(link => link.props('to'))).toEqual([
      { path: '/admin/carpool', query: {} },
      { path: '/admin/carpool', query: { tab: 'members' } },
      { path: '/admin/carpool', query: { tab: 'temporary' } },
      { path: '/admin/carpool', query: { tab: 'diagnostics' } }
    ])
    expect(wrapper.get('[data-testid="carpool-edition"]').text()).toBe('carpool.navigation.edition')
    expect(wrapper.text()).toContain('carpool.navigation.systemOverview')
    expect(wrapper.findAllComponents(RouterLinkStub).find(link => link.props('to') === '/admin/dashboard')).toBeTruthy()
    wrapper.unmount()
  })
  it.each(['overview', 'members', 'temporary', 'diagnostics'])('marks only the selected %s query tab current', tab => {
    state.route.query = { tab }
    const wrapper = render()
    const current = wrapper.get('[data-testid="carpool-navigation"]').findAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toBe(`carpool.tabs.${tab}`)
    wrapper.unmount()
  })
  it('uses overview for unknown tab names and no selection on other pages', () => {
    state.route.query = { tab: 'unknown' }
    let wrapper = render()
    expect(wrapper.get('[aria-current="page"]').text()).toBe('carpool.tabs.overview')
    wrapper.unmount()
    state.route.path = '/admin/users'
    wrapper = render()
    expect(wrapper.find('[data-testid="carpool-navigation"] [aria-current="page"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it.each([[false, false], [true, true]])('hides workspace for admin=%s simple=%s', (isAdmin, isSimpleMode) => {
    state.auth.isAdmin = isAdmin
    state.auth.isSimpleMode = isSimpleMode
    const wrapper = render()
    expect(wrapper.find('[data-testid="carpool-navigation"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="carpool-edition"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('preserves the current workspace period and metric across sidebar tabs', () => {
    state.route.query = { tab: 'members', cp_period: 'custom', cp_metric: 'requests', cp_start: '2026-10-01', cp_end: '2026-10-07' }
    const wrapper = render()
    const links = wrapper.get('[data-testid="carpool-navigation"]').findAllComponents(RouterLinkStub)
    expect(links[0].props('to')).toEqual({ path: '/admin/carpool', query: { cp_period: 'custom', cp_metric: 'requests', cp_start: '2026-10-01', cp_end: '2026-10-07' } })
    expect(links[3].props('to')).toEqual({ path: '/admin/carpool', query: { ...state.route.query, tab: 'diagnostics' } })
    wrapper.unmount()
  })
  it('does not bring unrelated page queries into the workspace', () => {
    state.route.path = '/admin/users'
    state.route.query = { email: 'private@example.test', page: '2' }
    const wrapper = render()
    const links = wrapper.get('[data-testid="carpool-navigation"]').findAllComponents(RouterLinkStub)
    expect(links[0].props('to')).toEqual({ path: '/admin/carpool', query: {} })
    expect(links[1].props('to')).toEqual({ path: '/admin/carpool', query: { tab: 'members' } })
    wrapper.unmount()
  })
  it('retains accessible titles when collapsed and preserves the saved dark theme', () => {
    state.app.sidebarCollapsed = true
    localStorage.setItem('theme', 'dark')
    const wrapper = render()
    const links = wrapper.get('[data-testid="carpool-navigation"]').findAllComponents(RouterLinkStub)
    expect(links.every(link => Boolean(link.attributes('title')))).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
    wrapper.unmount()
    localStorage.removeItem('theme')
    document.documentElement.classList.remove('dark')
  })
})
