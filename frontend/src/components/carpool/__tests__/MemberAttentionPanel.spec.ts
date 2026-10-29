import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUser, PaginatedResponse, UserSubscription } from '@/types'
import MemberAttentionPanel from '../MemberAttentionPanel.vue'
import en from '@/i18n/locales/en/carpoolAttention'
import zh from '@/i18n/locales/zh/carpoolAttention'

const mocks = vi.hoisted(() => ({ users: vi.fn(), subscriptions: vi.fn(), updateBalance: vi.fn(), assign: vi.fn() }))
vi.mock('@/api/admin', () => ({ adminAPI: {
  users: { list: mocks.users, updateBalance: mocks.updateBalance },
  subscriptions: { list: mocks.subscriptions, assign: mocks.assign }
} }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({
  locale: { value: 'en' },
  t: (key: string, params?: Record<string, unknown>) => params ? `${key} ${JSON.stringify(params)}` : key
}) }))
enableAutoUnmount(afterEach)
const now = Date.parse('2026-10-28T12:00:00Z')

function member(id = 1, overrides: Partial<AdminUser> = {}): AdminUser {
  return { id, username: `Member ${id}`, email: `member${id}@example.com`, role: 'user', status: 'active', balance: 2, subscriptions: [], ...overrides } as AdminUser
}

function subscription(id = 1, overrides: Partial<UserSubscription> = {}): UserSubscription {
  return { id, user_id: id, group_id: 4, status: 'active', starts_at: '2026-01-01T00:00:00Z', expires_at: '2026-10-30T12:00:00Z',
    user: { id, username: `Subscriber ${id}`, email: `subscriber${id}@example.com` }, group: { name: `Plan ${id}` }, ...overrides } as UserSubscription
}

function pageOf<T>(items: T[], total = items.length): PaginatedResponse<T> {
  return { items, total, page: 1, page_size: 100, pages: Math.ceil(total / 100) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function render() {
  return mount(MemberAttentionPanel, { global: { stubs: {
    RouterLink: { props: ['to'], template: '<a :data-destination="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>' }
  } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  mocks.users.mockResolvedValue(pageOf([member()]))
  mocks.subscriptions.mockResolvedValue(pageOf([subscription()]))
})
afterEach(() => vi.restoreAllMocks())

describe('MemberAttentionPanel', () => {
  it('uses bounded, authenticated read APIs with the server-supported order and no writes', async () => {
    const wrapper = render()
    await flushPromises()
    expect(mocks.users).toHaveBeenCalledWith(1, 100, {
      role: 'user', status: 'active', include_subscriptions: true, sort_by: 'balance', sort_order: 'asc'
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(mocks.subscriptions).toHaveBeenCalledWith(1, 100, {
      status: 'active', sort_by: 'expires_at', sort_order: 'asc'
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('1')
    expect(wrapper.text()).toContain('carpoolAttention.thresholdNote')
    expect(wrapper.text()).toContain('carpoolAttention.scopeDisclaimer')
    expect(wrapper.find('[data-destination="/admin/subscriptions"]').exists()).toBe(true)
    expect(mocks.updateBalance).not.toHaveBeenCalled()
    expect(mocks.assign).not.toHaveBeenCalled()
  })

  it('only reminds active regular members without a current subscription, including zero and negative balances', async () => {
    mocks.users.mockResolvedValue(pageOf([
      member(1, { balance: 0 }),
      member(2, { balance: -1 }),
      member(3, { balance: 5 }),
      member(4, { balance: 5.01 }),
      member(5, { balance: 1, status: 'disabled' }),
      member(6, { balance: 1, role: 'admin' }),
      member(7, { balance: 1, subscriptions: [subscription()] }),
      member(8, { balance: 1, subscriptions: [subscription(8, { expires_at: null })] }),
      member(9, { balance: 1, subscriptions: [subscription(9, { expires_at: '2026-10-28T12:00:00Z' })] }),
      member(10, { balance: 1, subscriptions: [subscription(10, { starts_at: '2026-10-29T12:00:00Z' })] })
    ]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('5')
    for (const id of [1, 2, 3, 9, 10]) expect(wrapper.find(`[data-test="low-balance-${id}"]`).exists()).toBe(true)
    for (const id of [4, 5, 6, 7, 8]) expect(wrapper.find(`[data-test="low-balance-${id}"]`).exists()).toBe(false)
    expect(wrapper.get('[data-test="low-balance-1"]').text()).toContain('$0.00')
    expect(wrapper.find('[data-test="balance-empty"]').exists()).toBe(false)
  })

  it('changes only the local reminder threshold, including the exact boundary, without new calls', async () => {
    mocks.users.mockResolvedValue(pageOf([member(1, { balance: 0 }), member(2, { balance: 5 }), member(3, { balance: 5.01 })]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('2')
    await wrapper.get('#attention-balance-threshold').setValue('0')
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('1')
    await wrapper.get('#attention-balance-threshold').setValue('5.01')
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('3')
    expect(mocks.users).toHaveBeenCalledTimes(1)
    expect(mocks.updateBalance).not.toHaveBeenCalled()
  })

  it.each(['', '-1', '1e309'])('rejects invalid threshold %s without turning unknown results into zero', async value => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#attention-balance-threshold').setValue(value)
    expect(wrapper.get('#attention-balance-threshold').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('—')
    expect(wrapper.text()).toContain('carpoolAttention.invalidThreshold')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('1')
    expect(mocks.updateBalance).not.toHaveBeenCalled()
  })

  it('conservatively excludes invalid balances and unknown current-subscription dates', async () => {
    mocks.users.mockResolvedValue(pageOf([
      member(1, { balance: NaN }),
      member(2, { balance: Infinity }),
      member(3, { subscriptions: [subscription(3, { starts_at: 'not-a-date' })] }),
      member(4, { subscriptions: [subscription(4, { expires_at: '2026-02-30T12:00:00Z' })] }),
      member(5, { subscriptions: [subscription(5, { status: 'revoked', starts_at: 'invalid' })] })
    ]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('1')
    expect(wrapper.find('[data-test="low-balance-5"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('carpoolAttention.invalidMembers {"count":4}')
    expect(wrapper.text()).not.toContain('NaN')
    expect(wrapper.text()).not.toContain('$∞')
  })

  it('excludes expired, future-starting, revoked, no-expiry and invalid subscriptions, respecting the seven-day boundary', async () => {
    mocks.subscriptions.mockResolvedValue(pageOf([
      subscription(1, { expires_at: '2026-10-28T12:00:01Z' }),
      subscription(2, { expires_at: '2026-11-04T12:00:00Z' }),
      subscription(3, { expires_at: '2026-11-04T12:00:01Z' }),
      subscription(4, { expires_at: '2026-10-28T12:00:00Z' }),
      subscription(5, { starts_at: '2026-10-29T12:00:00Z' }),
      subscription(6, { expires_at: null }),
      subscription(7, { status: 'revoked' }),
      subscription(8, { expires_at: 'not-a-date' }),
      subscription(9, { expires_at: '2026-02-30T12:00:00Z' }),
      subscription(10, { starts_at: '2026-11-01T12:00:00Z', expires_at: '2026-10-30T12:00:00Z' }),
      subscription(11, { starts_at: '2026-01-01T25:00:00Z' })
    ]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('2')
    expect(wrapper.find('[data-test="expiring-subscription-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="expiring-subscription-2"]').exists()).toBe(true)
    for (const id of [3, 4, 5, 6, 7, 8, 9, 10, 11]) expect(wrapper.find(`[data-test="expiring-subscription-${id}"]`).exists()).toBe(false)
    expect(wrapper.text()).toContain('carpoolAttention.invalidSubscriptions {"count":4}')
    expect(wrapper.text()).toContain('carpoolAttention.withinOneDay')
    expect(wrapper.text()).toContain('carpoolAttention.daysRemaining {"count":7}')
  })

  it('accepts timezone offsets and valid leap-day timestamps instead of assuming browser date-only semantics', async () => {
    mocks.subscriptions.mockResolvedValue(pageOf([
      subscription(1, { starts_at: '2024-02-29T00:00:00Z', expires_at: '2026-10-29T20:00:00+08:00' }),
      subscription(2, { starts_at: '2025-02-29T00:00:00Z' })
    ]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="expiring-subscription-1"]').text()).toContain('carpoolAttention.withinOneDay')
    expect(wrapper.text()).toContain('carpoolAttention.invalidSubscriptions {"count":1}')
  })

  it('never inspects or claims totals beyond the first 100 returned records per source', async () => {
    mocks.users.mockResolvedValue(pageOf(Array.from({ length: 101 }, (_, index) => member(index + 1)), 999999))
    mocks.subscriptions.mockResolvedValue(pageOf(Array.from({ length: 101 }, (_, index) => subscription(index + 1)), 888888))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('100')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('100')
    expect(wrapper.find('[data-test="low-balance-101"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="expiring-subscription-101"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('carpoolAttention.memberScope {"inspected":100,"limit":100}')
    expect(wrapper.text()).not.toContain('999999')
    expect(wrapper.text()).not.toContain('888888')
  })

  it('distinguishes no returned data from zero matches within real returned data', async () => {
    mocks.users.mockResolvedValueOnce(pageOf([])).mockResolvedValueOnce(pageOf([member(1, { balance: 99 })]))
    mocks.subscriptions.mockResolvedValueOnce(pageOf([])).mockResolvedValueOnce(pageOf([subscription(1, { expires_at: '2099-01-01T00:00:00Z' })]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('carpoolAttention.noMembers')
    expect(wrapper.text()).toContain('carpoolAttention.noSubscriptions')
    await wrapper.get('[data-test="refresh-members"]').trigger('click')
    await wrapper.get('[data-test="refresh-subscriptions"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('carpoolAttention.noLowBalance')
    expect(wrapper.text()).toContain('carpoolAttention.noExpiring')
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('0')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('0')
  })

  it('keeps successful subscription checks available when members fail and retries only the failed source', async () => {
    mocks.users.mockRejectedValueOnce(new Error('private failure detail'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('—')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('1')
    expect(wrapper.text()).toContain('carpoolAttention.membersError')
    expect(wrapper.text()).not.toContain('private failure detail')
    await wrapper.get('[data-test="refresh-members"]').trigger('click')
    await flushPromises()
    expect(mocks.users).toHaveBeenCalledTimes(2)
    expect(mocks.subscriptions).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('1')
  })

  it('clears stale successful subscription rows after a failed recheck instead of showing zero or old warnings', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('[data-test="expiring-subscription-1"]').exists()).toBe(true)
    mocks.subscriptions.mockRejectedValueOnce(new Error('unavailable'))
    await wrapper.get('[data-test="refresh-subscriptions"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('—')
    expect(wrapper.find('[data-test="expiring-subscription-1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('carpoolAttention.subscriptionsError')
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('1')
  })

  it('handles independent loading states and rejects stale responses from both sources', async () => {
    const oldMembers = deferred<PaginatedResponse<AdminUser>>()
    const oldSubscriptions = deferred<PaginatedResponse<UserSubscription>>()
    mocks.users.mockReturnValueOnce(oldMembers.promise)
    mocks.subscriptions.mockReturnValueOnce(oldSubscriptions.promise)
    const wrapper = render()
    const membersSignal = mocks.users.mock.calls[0][3].signal as AbortSignal
    const subscriptionsSignal = mocks.subscriptions.mock.calls[0][3].signal as AbortSignal
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('…')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('…')
    mocks.users.mockResolvedValueOnce(pageOf([member(2)]))
    await wrapper.get('[data-test="refresh-members"]').trigger('click')
    await flushPromises()
    expect(membersSignal.aborted).toBe(true)
    expect(wrapper.get('[data-test="balance-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="subscription-count"]').text()).toBe('…')
    mocks.subscriptions.mockResolvedValueOnce(pageOf([subscription(2)]))
    await wrapper.get('[data-test="refresh-subscriptions"]').trigger('click')
    await flushPromises()
    expect(subscriptionsSignal.aborted).toBe(true)
    oldMembers.resolve(pageOf([member(1)]))
    oldSubscriptions.resolve(pageOf([subscription(1)]))
    await flushPromises()
    expect(wrapper.find('[data-test="low-balance-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="low-balance-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="expiring-subscription-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="expiring-subscription-2"]').exists()).toBe(true)
  })

  it('aborts both sources on unmount without any write side effect', async () => {
    const members = deferred<PaginatedResponse<AdminUser>>()
    const subscriptions = deferred<PaginatedResponse<UserSubscription>>()
    mocks.users.mockReturnValueOnce(members.promise)
    mocks.subscriptions.mockReturnValueOnce(subscriptions.promise)
    const wrapper = render()
    const signals = [mocks.users.mock.calls[0][3].signal, mocks.subscriptions.mock.calls[0][3].signal] as AbortSignal[]
    wrapper.unmount()
    expect(signals.every(signal => signal.aborted)).toBe(true)
    members.resolve(pageOf([member()]))
    subscriptions.resolve(pageOf([subscription()]))
    await flushPromises()
    expect(mocks.updateBalance).not.toHaveBeenCalled()
    expect(mocks.assign).not.toHaveBeenCalled()
  })

  it('provides the same complete reminder copy in Chinese and English', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(Object.values(zh).every(value => value.length > 0)).toBe(true)
    expect(Object.values(en).every(value => value.length > 0)).toBe(true)
  })
})
