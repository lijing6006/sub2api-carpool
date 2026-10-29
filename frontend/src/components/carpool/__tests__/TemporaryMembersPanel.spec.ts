import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TemporaryMembersPanel from '../TemporaryMembersPanel.vue'
import en from '@/i18n/locales/en/tempMembers'
import type { TemporaryMember } from '@/api/admin/temporaryMembers'

const api = vi.hoisted(() => ({ listTemporaryMembers: vi.fn(), createTemporaryMember: vi.fn(), updateTemporaryMember: vi.fn() }))
vi.mock('@/api/admin/temporaryMembers', () => api)
const empty = { items: [], total: 0, pages: 0, page: 1, page_size: 20 }
const member = {
  id: 1, username: 'Guest', email: 'guest@example.test', status: 'active', balance: 99,
  temporary_expires_at: new Date(Date.now() + 86400_000).toISOString(), temporary_budget_usd: 10,
  temporary_spent_usd: 4, api_keys: [{ key: 'must-not-be-visible-secret' }]
} as unknown as TemporaryMember
vi.mock('vue-i18n', () => ({ useI18n: () => ({
  locale: { value: 'en' },
  t: (key: string, values?: Record<string, string | number>) => {
    const message = en[key.replace('tempMembers.', '') as keyof typeof en] || key
    return message.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? name))
  }
}) }))
const mountPanel = () => mount(TemporaryMembersPanel)

beforeEach(() => { vi.clearAllMocks(); api.listTemporaryMembers.mockResolvedValue(empty) })

describe('TemporaryMembersPanel', () => {
  it('renders honest empty and policy states without generating credentials', async () => {
    const wrapper = mountPanel(); await flushPromises()
    expect(wrapper.text()).toContain('No temporary members yet')
    expect(wrapper.text()).toContain('Post-request soft limit')
    expect(api.createTemporaryMember).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('shows a load error and recovers with refresh', async () => {
    api.listTemporaryMembers.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountPanel(); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to load')
    await wrapper.findAll('button').find(b => b.text() === 'Refresh')!.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('No temporary members yet'); wrapper.unmount()
  })
  it('separates prepaid balance from actual spending and never renders keys', async () => {
    api.listTemporaryMembers.mockResolvedValue({ ...empty, items: [member], total: 1, pages: 1 })
    const wrapper = mountPanel(); await flushPromises()
    expect(wrapper.text()).toContain('$99.00'); expect(wrapper.text()).toContain('$4.00')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    expect(wrapper.text()).not.toContain('must-not-be-visible-secret'); wrapper.unmount()
  })
  it('rejects invalid limits and passwords before sending a write', async () => {
    const wrapper = mountPanel(); await flushPromises(); await wrapper.get('[data-testid="temporary-create"]').trigger('click')
    await wrapper.get('#temporary-budget').setValue('0'); await wrapper.get('[data-testid="temporary-form"]').trigger('submit')
    expect(wrapper.text()).toContain('Enter a positive limit'); expect(api.createTemporaryMember).not.toHaveBeenCalled()
    await wrapper.get('#temporary-budget').setValue('10'); await wrapper.get('#temporary-email').setValue('guest@example.test'); await wrapper.get('#temporary-password').setValue('short')
    await wrapper.get('[data-testid="temporary-form"]').trigger('submit'); expect(wrapper.text()).toContain('at least 12 characters'); expect(api.createTemporaryMember).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('submits once, keeps explicit spending and balance fields, clears password on completion', async () => {
    let resolve!: (value: TemporaryMember) => void
    api.createTemporaryMember.mockReturnValue(new Promise<TemporaryMember>(r => { resolve = r }))
    const wrapper = mountPanel(); await flushPromises(); await wrapper.get('[data-testid="temporary-create"]').trigger('click')
    await wrapper.get('#temporary-email').setValue('guest@example.test'); await wrapper.get('#temporary-password').setValue('long-password-123'); await wrapper.get('#temporary-balance').setValue('5')
    await wrapper.get('[data-testid="temporary-form"]').trigger('submit'); await wrapper.get('[data-testid="temporary-form"]').trigger('submit')
    expect(api.createTemporaryMember).toHaveBeenCalledTimes(1)
    expect(api.createTemporaryMember).toHaveBeenCalledWith(expect.objectContaining({ email: 'guest@example.test', balance: 5, temporary_budget_usd: 10 }))
    resolve(member); await flushPromises(); expect(wrapper.find('#temporary-password').exists()).toBe(false)
    await wrapper.get('[data-testid="temporary-create"]').trigger('click'); expect((wrapper.get('#temporary-password').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
  it('ignores stale responses after a newer search and aborts on unmount', async () => {
    let resolveOld!: (value: unknown) => void
    api.listTemporaryMembers.mockReturnValueOnce(new Promise(r => { resolveOld = r })).mockResolvedValueOnce(empty)
    const wrapper = mountPanel(); await wrapper.get('input[placeholder="Search by name or email"]').setValue('new')
    await wrapper.findAll('button').find(b => b.text() === 'Search')!.trigger('submit'); await flushPromises()
    resolveOld({ ...empty, items: [member], total: 1, pages: 1 }); await flushPromises()
    expect(wrapper.text()).not.toContain('guest@example.test')
    const signal = api.listTemporaryMembers.mock.calls.at(-1)![2] as AbortSignal
    wrapper.unmount(); expect(signal.aborted).toBe(true)
  })
  it('edits the cap without sending or resetting cumulative consumption', async () => {
    api.listTemporaryMembers.mockResolvedValue({ ...empty, items: [member], total: 1, pages: 1 }); api.updateTemporaryMember.mockResolvedValue(member)
    const wrapper = mountPanel(); await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'Extend / adjust limit')!.trigger('click')
    await wrapper.get('#temporary-budget').setValue('12'); await wrapper.get('[data-testid="temporary-form"]').trigger('submit'); await flushPromises()
    expect(api.updateTemporaryMember).toHaveBeenCalledWith(1, { temporary_budget_usd: 12, temporary_expires_at: expect.any(String) })
    wrapper.unmount()
  })
  it('clears a manually entered password when the form is cancelled', async () => {
    const wrapper = mountPanel(); await flushPromises()
    await wrapper.get('[data-testid="temporary-create"]').trigger('click')
    await wrapper.get('#temporary-password').setValue('private-password-123')
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')!.trigger('click')
    expect(wrapper.find('#temporary-password').exists()).toBe(false)
    await wrapper.get('[data-testid="temporary-create"]').trigger('click')
    expect((wrapper.get('#temporary-password').element as HTMLInputElement).value).toBe('')
    expect(api.createTemporaryMember).not.toHaveBeenCalled(); wrapper.unmount()
  })
  it('does not auto-retry an uncertain write and tells the administrator to verify', async () => {
    api.createTemporaryMember.mockRejectedValue(new Error('connection interrupted'))
    const wrapper = mountPanel(); await flushPromises()
    await wrapper.get('[data-testid="temporary-create"]').trigger('click')
    await wrapper.get('#temporary-email').setValue('guest@example.test')
    await wrapper.get('#temporary-password').setValue('long-password-123')
    await wrapper.get('[data-testid="temporary-form"]').trigger('submit'); await flushPromises()
    expect(api.createTemporaryMember).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('refresh and verify the member before retrying')
    expect(wrapper.find('[data-testid="temporary-form"]').exists()).toBe(true); wrapper.unmount()
  })
  it('sends only status when disabling and guards repeated clicks', async () => {
    api.listTemporaryMembers.mockResolvedValue({ ...empty, items: [member], total: 1, pages: 1 })
    let resolve!: (value: TemporaryMember) => void
    api.updateTemporaryMember.mockReturnValue(new Promise<TemporaryMember>(r => { resolve = r }))
    const wrapper = mountPanel(); await flushPromises()
    const disable = wrapper.findAll('button').find(b => b.text() === 'Disable')!
    await disable.trigger('click'); await disable.trigger('click')
    expect(api.updateTemporaryMember).toHaveBeenCalledTimes(1)
    expect(api.updateTemporaryMember).toHaveBeenCalledWith(1, { status: 'disabled' })
    resolve({ ...member, status: 'disabled' }); await flushPromises(); wrapper.unmount()
  })

})
