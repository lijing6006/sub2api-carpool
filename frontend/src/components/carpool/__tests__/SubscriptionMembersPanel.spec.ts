import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminGroup, AdminUser, PaginatedResponse, UserSubscription } from '@/types'
import SubscriptionMembersPanel from '../SubscriptionMembersPanel.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  getAll: vi.fn(),
  assign: vi.fn(),
  updateBalance: vi.fn(),
  paymentEnabled: false
}))
vi.mock('@/api/admin', () => ({ adminAPI: {
  users: { list: mocks.list, getById: mocks.getById, updateBalance: mocks.updateBalance },
  groups: { getAll: mocks.getAll },
  subscriptions: { assign: mocks.assign }
} }))
vi.mock('@/stores/adminSettings', () => ({ useAdminSettingsStore: () => mocks }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({
  locale: { value: 'en' },
  t: (key: string, params?: Record<string, unknown>) => params ? `${key} ${JSON.stringify(params)}` : key
}) }))
enableAutoUnmount(afterEach)

function member(id = 1, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id, username: `Member ${id}`, email: `member${id}@example.com`, role: 'user',
    balance: 12.5, status: 'active', subscriptions: [], ...overrides
  } as AdminUser
}

function group(id = 4, overrides: Partial<AdminGroup> = {}): AdminGroup {
  return {
    id, name: `Group ${id}`, platform: 'openai', status: 'active', subscription_type: 'subscription',
    daily_limit_usd: 5, weekly_limit_usd: 20, monthly_limit_usd: null, ...overrides
  } as AdminGroup
}

function pageOf(items: AdminUser[], pages = 1): PaginatedResponse<AdminUser> {
  return { items, total: items.length, page: 1, page_size: 12, pages }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function render() {
  return mount(SubscriptionMembersPanel, { global: { stubs: {
    RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
    BaseDialog: {
      name: 'BaseDialog',
      props: ['show', 'title', 'showCloseButton', 'closeOnEscape'],
      emits: ['close'],
      template: '<section v-if="show" data-test="dialog"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>'
    }
  } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('auth_user', JSON.stringify({ id: ++adminIdentity }))
  sessionStorage.clear()
  mocks.list.mockResolvedValue(pageOf([member()]))
  mocks.getAll.mockResolvedValue([group()])
  mocks.assign.mockResolvedValue({ id: 9 })
  mocks.updateBalance.mockResolvedValue(member(1, { balance: 22.5 }))
  mocks.getById.mockResolvedValue(member(1, { balance: 22.5 }))
  mocks.paymentEnabled = false
})

let adminIdentity = 100

describe('SubscriptionMembersPanel', () => {
  it('loads actual regular-member data with subscriptions, and explains balance billing without inventing quotas', async () => {
    const wrapper = render()
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledWith(1, 12, expect.objectContaining({ role: 'user', include_subscriptions: true }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.text()).toContain('Member 1')
    expect(wrapper.text()).toContain('$12.50')
    expect(wrapper.text()).toContain('carpoolMembers.noSubscription')
    expect(wrapper.text()).toContain('carpoolMembers.billingNote')
    expect(wrapper.find('a[href="/admin/groups"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/admin/orders/plans"]').exists()).toBe(false)
    expect(mocks.assign).not.toHaveBeenCalled()
    expect(mocks.updateBalance).not.toHaveBeenCalled()
  })

  it('shows only current subscriptions, with their actual expiry', async () => {
    const subscription = (id: number, overrides: Partial<UserSubscription> = {}) => ({
      id, user_id: 1, group_id: 4, status: 'active', starts_at: '2020-01-01T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z', group: { name: `Subscription ${id}` }, ...overrides
    } as UserSubscription)
    mocks.list.mockResolvedValue(pageOf([member(1, { subscriptions: [
      subscription(1), subscription(2, { status: 'revoked' }),
      subscription(3, { expires_at: '2020-02-01T00:00:00Z' }),
      subscription(4, { starts_at: '2098-01-01T00:00:00Z' })
    ] })]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('Subscription 1')
    expect(wrapper.text()).not.toContain('Subscription 2')
    expect(wrapper.text()).not.toContain('Subscription 3')
    expect(wrapper.text()).not.toContain('Subscription 4')
    expect(wrapper.text()).toContain('2099')
  })

  it('supports pagination and resets the page when searching', async () => {
    mocks.list.mockResolvedValue(pageOf([member()], 3))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="next-page"]').trigger('click')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(2, 12, expect.anything(), expect.anything())
    await wrapper.get('#carpool-member-search').setValue('  alice  ')
    await wrapper.get('[data-test="member-search"]').trigger('submit')
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(1, 12, expect.objectContaining({ search: 'alice' }), expect.anything())
  })

  it('does not let an older search overwrite a newer search and aborts the old request', async () => {
    const oldResponse = deferred<PaginatedResponse<AdminUser>>()
    mocks.list.mockReturnValueOnce(oldResponse.promise)
    const wrapper = render()
    const oldSignal = mocks.list.mock.calls[0][3].signal as AbortSignal
    mocks.list.mockResolvedValueOnce(pageOf([member(2)]))
    await wrapper.get('#carpool-member-search').setValue('Member 2')
    await wrapper.get('[data-test="member-search"]').trigger('submit')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    expect(wrapper.text()).toContain('Member 2')
    oldResponse.resolve(pageOf([member(1)]))
    await flushPromises()
    expect(wrapper.text()).not.toContain('Member 1')
    expect(wrapper.text()).toContain('Member 2')
  })

  it('shows failed and empty loads distinctly and allows retry', async () => {
    mocks.list.mockRejectedValueOnce({ message: 'Permission denied' }).mockResolvedValueOnce(pageOf([]))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Permission denied')
    expect(wrapper.text()).not.toContain('carpoolMembers.emptyTitle')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('carpoolMembers.emptyTitle')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('assigns only active subscription groups and prevents duplicate submission / closing while pending', async () => {
    mocks.getAll.mockResolvedValue([
      group(), group(5, { subscription_type: 'standard' }), group(6, { status: 'inactive' })
    ])
    const pending = deferred<{ id: number }>()
    mocks.assign.mockReturnValueOnce(pending.promise)
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="assign-1"]').trigger('click')
    await flushPromises()
    const options = wrapper.findAll('#carpool-subscription-group option')
    expect(options.map(option => option.text())).toEqual(['carpoolMembers.selectGroup', 'Group 4 · openai'])
    await wrapper.get('#carpool-subscription-group').setValue('4')
    expect(wrapper.text()).toContain('$5.00')
    expect(wrapper.text()).toContain('$20.00')
    expect(wrapper.text()).toContain('carpoolMembers.unlimited')
    await wrapper.get('#carpool-subscription-days').setValue('14')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    wrapper.getComponent({ name: 'BaseDialog' }).vm.$emit('close')
    await flushPromises()
    expect(mocks.assign).toHaveBeenCalledTimes(1)
    expect(mocks.assign).toHaveBeenCalledWith({ user_id: 1, group_id: 4, validity_days: 14 })
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(true)
    pending.resolve({ id: 9 })
    await flushPromises()
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('changed')).toEqual([[]])
    expect(wrapper.text()).toContain('carpoolMembers.assigned')
  })

  it.each([0, 1.5, 36501])('rejects invalid subscription validity %s before calling the server', async days => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="assign-1"]').trigger('click')
    await flushPromises()
    await wrapper.get('#carpool-subscription-group').setValue('4')
    await wrapper.get('#carpool-subscription-days').setValue(days)
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    expect(mocks.assign).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('carpoolMembers.invalidDays')
  })

  it('preserves assignment input and reports the server error without false success', async () => {
    mocks.assign.mockRejectedValueOnce({ message: 'Subscription assignment conflicts with existing term' })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="assign-1"]').trigger('click')
    await flushPromises()
    await wrapper.get('#carpool-subscription-group').setValue('4')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Subscription assignment conflicts with existing term')
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(true)
    expect(wrapper.emitted('changed')).toBeUndefined()
    expect(wrapper.get('[data-test="confirm-action"]').attributes('disabled')).toBeUndefined()
  })

  it('disables assignment for disabled members and explains missing subscription groups', async () => {
    mocks.list.mockResolvedValue(pageOf([member(), member(2, { status: 'disabled' })]))
    mocks.getAll.mockResolvedValue([])
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-test="assign-2"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="assign-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('carpoolMembers.noGroups')
    expect(wrapper.get('[data-test="confirm-action"]').attributes('disabled')).toBeDefined()
  })

  it('requires a positive balance amount and audit note, then adds rather than overwrites balance', async () => {
    const pending = deferred<AdminUser>()
    mocks.updateBalance.mockReturnValueOnce(pending.promise)
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="balance-1"]').trigger('click')
    await wrapper.get('#carpool-balance-amount').setValue('10')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    expect(mocks.updateBalance).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('carpoolMembers.invalidBalance')
    await wrapper.get('#carpool-balance-note').setValue('  Confirmed offline credit  ')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    expect(mocks.updateBalance).toHaveBeenCalledTimes(1)
    expect(mocks.updateBalance).toHaveBeenCalledWith(1, 10, 'add', 'Confirmed offline credit', expect.stringContaining('carpool-balance-'))
    pending.resolve(member(1, { balance: 22.5 }))
    await flushPromises()
    expect(wrapper.text()).toContain('carpoolMembers.balanceAdded')
    expect(wrapper.emitted('changed')).toEqual([[]])
  })

  it('requires balance reconciliation after an uncertain write instead of blindly repeating the credit', async () => {
    mocks.updateBalance.mockRejectedValueOnce(new Error('Network response lost'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="balance-1"]').trigger('click')
    await wrapper.get('#carpool-balance-amount').setValue('10')
    await wrapper.get('#carpool-balance-note').setValue('Offline credit')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('carpoolMembers.reviewBeforeRetry')
    expect(wrapper.find('[data-test="confirm-action"]').exists()).toBe(false)
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    expect(mocks.updateBalance).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-test="review-balance"]').trigger('click')
    await flushPromises()
    expect(mocks.getById).toHaveBeenCalledWith(1)
    expect(wrapper.get('[data-test="dialog"]').text()).toContain('$22.50')
    expect((wrapper.get('#carpool-balance-amount').element as HTMLInputElement).value).toBe('10')
    expect(wrapper.get('#carpool-balance-amount').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('carpoolMembers.retrySameAdjustment')
    expect(wrapper.find('[data-test="confirm-action"]').exists()).toBe(true)
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('preserves an uncertain credit across close/reopen and replays the same operation key only after review', async () => {
    mocks.updateBalance.mockRejectedValueOnce(new Error('Response lost'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="balance-1"]').trigger('click')
    await wrapper.get('#carpool-balance-amount').setValue('10')
    await wrapper.get('#carpool-balance-note').setValue('Offline credit')
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    await flushPromises()
    const firstKey = mocks.updateBalance.mock.calls[0][4]
    wrapper.getComponent({ name: 'BaseDialog' }).vm.$emit('close')
    await flushPromises()
    await wrapper.get('[data-test="balance-1"]').trigger('click')
    expect(wrapper.text()).toContain('carpoolMembers.reviewBeforeRetry')
    expect(wrapper.find('[data-test="confirm-action"]').exists()).toBe(false)
    expect((wrapper.get('#carpool-balance-amount').element as HTMLInputElement).value).toBe('10')
    await wrapper.get('[data-test="review-balance"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="member-action-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.updateBalance).toHaveBeenCalledTimes(2)
    expect(mocks.updateBalance).toHaveBeenLastCalledWith(1, 10, 'add', 'Offline credit', firstKey)
    expect(wrapper.emitted('changed')).toEqual([[]])
  })

  it('blocks assignment when groups fail to load, then recovers without losing the chosen member', async () => {
    mocks.getAll.mockRejectedValueOnce({ message: 'Group request failed' })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-test="assign-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="dialog"]').text()).toContain('Group request failed')
    expect(wrapper.get('[data-test="confirm-action"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="dialog"] [role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="dialog"]').text()).toContain('member1@example.com')
    expect(wrapper.find('#carpool-subscription-group').exists()).toBe(true)
    expect(mocks.assign).not.toHaveBeenCalled()
  })

  it('detects an unconfirmed identical credit after leaving and remounting the panel', async () => {
    mocks.updateBalance.mockRejectedValueOnce(new Error('Response lost'))
    const first = render()
    await flushPromises()
    await first.get('[data-test="balance-1"]').trigger('click')
    await first.get('#carpool-balance-amount').setValue('10')
    await first.get('#carpool-balance-note').setValue('Offline credit')
    await first.get('[data-test="member-action-form"]').trigger('submit')
    await flushPromises()
    const operationKey = mocks.updateBalance.mock.calls[0][4]
    first.unmount()
    const second = render()
    await flushPromises()
    await second.get('[data-test="balance-1"]').trigger('click')
    await second.get('#carpool-balance-amount').setValue('10')
    await second.get('#carpool-balance-note').setValue('Offline credit')
    await second.get('[data-test="member-action-form"]').trigger('submit')
    expect(mocks.updateBalance).toHaveBeenCalledTimes(1)
    expect(second.text()).toContain('carpoolMembers.reviewBeforeRetry')
    await second.get('[data-test="review-balance"]').trigger('click')
    await flushPromises()
    await second.get('[data-test="member-action-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.updateBalance).toHaveBeenLastCalledWith(1, 10, 'add', 'Offline credit', operationKey)
    expect(second.emitted('changed')).toEqual([[]])
  })

  it('aborts outstanding member reads on unmount', async () => {
    const pending = deferred<PaginatedResponse<AdminUser>>()
    mocks.list.mockReturnValueOnce(pending.promise)
    const wrapper = render()
    const signal = mocks.list.mock.calls[0][3].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pending.resolve(pageOf([member()]))
    await flushPromises()
    expect(mocks.assign).not.toHaveBeenCalled()
  })
})
