import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { UserSubscription } from '@/types'
import SubscriptionQuotaProgress from '../SubscriptionQuotaProgress.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: { value: 'en' }, t: (key: string) => key }) }))
const subscription = (extra = {}) => ({
  daily_usage_usd: 4, weekly_usage_usd: 21, monthly_usage_usd: 30,
  daily_window_start: '2020-01-01', weekly_window_start: '2020-01-01', monthly_window_start: null,
  group: { daily_limit_usd: 5, weekly_limit_usd: 20, monthly_limit_usd: null }, ...extra
} as UserSubscription)

describe('recorded subscription quota meters', () => {
  it('shows real recorded values without resetting old windows or hiding overspend', () => {
    const wrapper = mount(SubscriptionQuotaProgress, { props: { subscription: subscription() } })
    expect(wrapper.get('[data-test="quota-daily"]').text()).toContain('$4.00 / $5.00')
    expect(wrapper.get('[data-test="quota-daily"] [role="progressbar"]').attributes('aria-valuenow')).toBe('80')
    expect(wrapper.get('[data-test="quota-weekly"]').text()).toContain('$21.00 / $20.00')
    expect(wrapper.get('[data-test="quota-weekly"] [role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.get('[data-test="quota-monthly"]').text()).toContain('carpoolMembers.unlimited')
    expect(wrapper.get('[data-test="quota-monthly"]').text()).toContain('carpoolMembers.windowNotStarted')
    expect(wrapper.find('[data-test="quota-monthly"] [role="progressbar"]').exists()).toBe(false)
  })
  it('treats missing group data as unknown rather than zero or unlimited', () => {
    const wrapper = mount(SubscriptionQuotaProgress, { props: { subscription: subscription({ group: undefined }) } })
    expect(wrapper.get('[data-test="quota-daily"]').text()).toContain('$4.00 / —')
    expect(wrapper.text()).not.toContain('carpoolMembers.unlimited')
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
  })
  it('does not render invalid or nonfinite figures as progress', () => {
    const wrapper = mount(SubscriptionQuotaProgress, { props: { subscription: subscription({ daily_usage_usd: NaN, weekly_usage_usd: -1, monthly_usage_usd: Infinity, daily_window_start: undefined }) } })
    expect(wrapper.text()).not.toMatch(/NaN|Infinity|\$-1/)
    expect(wrapper.get('[data-test="quota-daily"]').text()).toContain('carpoolMembers.windowUnknown')
    expect(wrapper.get('[data-test="quota-daily"]').text()).not.toContain('carpoolMembers.windowNotStarted')
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
  })
})
