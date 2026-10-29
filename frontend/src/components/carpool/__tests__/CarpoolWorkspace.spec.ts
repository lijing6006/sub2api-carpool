import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import CarpoolDashboardView from '@/views/admin/CarpoolDashboardView.vue'
import en from '@/i18n/locales/en/carpool'
import zh from '@/i18n/locales/zh/carpool'

vi.mock('@/components/layout/AppLayout.vue', () => ({ __esModule: true, default: { template: '<main><slot /></main>' } }))
vi.mock('../CarpoolOverview.vue', () => ({ __esModule: true, default: { template: '<section data-test="overview-panel" />' } }))
vi.mock('../SubscriptionMembersPanel.vue', () => ({ __esModule: true, default: { template: '<section data-test="members-panel" />' } }))
vi.mock('../TemporaryMembersPanel.vue', () => ({ __esModule: true, default: { template: '<section data-test="temporary-panel" />' } }))
vi.mock('../ModelDiagnosticsPanel.vue', () => ({ __esModule: true, default: { template: '<section data-test="diagnostics-panel" />' } }))
vi.mock('../MemberAttentionPanel.vue', () => ({ __esModule: true, default: { template: '<aside data-test="attention-panel" />' } }))
enableAutoUnmount(afterEach)

async function render(locale = 'zh', url = '/admin/carpool') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/carpool', component: CarpoolDashboardView }] })
  await router.push(url)
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale, messages: { en: { carpool: en }, zh: { carpool: zh } } })
  const wrapper = mount(CarpoolDashboardView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { wrapper, router }
}

describe('carpool workspace discovery', () => {
  it.each(['zh', 'en'])('shows all four named workflows and a visible edition in %s', async locale => {
    const { wrapper } = await render(locale)
    const messages = locale === 'zh' ? zh : en
    expect(wrapper.get('h1').text()).toBe(messages.overview.title)
    expect(wrapper.text()).toContain('CARPOOL · V19')
    expect(wrapper.get('[data-test="manage-members"]').text()).toContain(messages.workspace.manageMembers)
    for (const tab of ['overview', 'members', 'temporary', 'diagnostics'] as const) {
      const link = wrapper.get(`[data-test="workspace-${tab}"]`)
      expect(link.text()).toContain(messages.tabs[tab])
      expect(link.text()).toContain(messages.workspace.hints[tab])
    }
    expect(wrapper.html()).not.toMatch(/carpool\.(workspace|navigation|tabs)\./)
  })

  it('switches workflows, retains analytics filters and restores the active panel on Back', async () => {
    const { wrapper, router } = await render('zh', '/admin/carpool?cp_period=7d&cp_metric=requests')
    expect(wrapper.get('[data-test="workspace-overview"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-test="attention-panel"]').exists()).toBe(true)
    await wrapper.get('[data-test="workspace-temporary"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ cp_period: '7d', cp_metric: 'requests', tab: 'temporary' })
    expect(wrapper.find('[data-test="temporary-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="attention-panel"]').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe(zh.tabs.temporary)
    router.back()
    await flushPromises()
    expect(wrapper.get('[data-test="workspace-overview"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-test="overview-panel"]').exists()).toBe(true)
  })

  it('opens the requested model panel directly without falling back to the old dashboard', async () => {
    const { wrapper } = await render('zh', '/admin/carpool?tab=diagnostics')
    expect(wrapper.get('h1').text()).toBe(zh.tabs.diagnostics)
    expect(wrapper.find('[data-test="diagnostics-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="attention-panel"]').exists()).toBe(false)
  })

  it('falls back to overview for an unknown tab without inventing a feature', async () => {
    const { wrapper } = await render('zh', '/admin/carpool?tab=unknown')
    expect(wrapper.get('h1').text()).toBe(zh.overview.title)
    expect(wrapper.find('[data-test="overview-panel"]').exists()).toBe(true)
  })
})
