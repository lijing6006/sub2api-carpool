import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import CarpoolOverview from '../CarpoolOverview.vue'
import type { DashboardSnapshotV2Response } from '@/api/admin/dashboard'
import type { UserBreakdownItem } from '@/types'

const { get, push, saveAs } = vi.hoisted(() => ({ get: vi.fn(), push: vi.fn(), saveAs: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: { get } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('file-saver', () => ({ saveAs }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: { value: 'en' }, t: (key: string) => key }) }))
vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options'], template: '<div data-test="line" />' },
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], template: '<div data-test="doughnut" />' }
}))
enableAutoUnmount(afterEach)
const member = (id = 1): UserBreakdownItem => ({ user_id: id, email: `member${id}@example.com`, requests: 2, input_tokens: 20, output_tokens: 30, cache_tokens: 0, total_tokens: 50, cost: 3, actual_cost: 1.25, account_cost: 0.5 })
const snapshot = (): DashboardSnapshotV2Response => ({ generated_at: '', start_date: '', end_date: '', granularity: 'day', trend: [{ date: '2026-10-28', requests: 9, input_tokens: 100, output_tokens: 200, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 300, cost: 7, actual_cost: 4 }], models: [{ model: 'sample-model', requests: 9, input_tokens: 100, output_tokens: 200, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 300, cost: 7, actual_cost: 4 }] })
const render = () => mount(CarpoolOverview)
function button(wrapper: ReturnType<typeof render>, text: string) { return wrapper.findAll('button').find(node => node.text() === text)! }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
beforeEach(() => {
  vi.clearAllMocks()
  get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('snapshot-v2') ? snapshot() : { users: [member()] } }))
})

describe('CarpoolOverview', () => {
  it('loads real administrator aggregates and labels its limited ranking', async () => {
    const wrapper = render(); await flushPromises()
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledWith('/admin/dashboard/user-breakdown', expect.objectContaining({ params: expect.objectContaining({ limit: 200, sort_by: 'actual_cost', timezone: expect.any(String) }), signal: expect.any(AbortSignal) }))
    expect(wrapper.text()).toContain('member1@example.com')
    expect(wrapper.text()).toContain('$4.00')
    expect(wrapper.text()).toContain('carpool.overview.rankingHint')
    expect(wrapper.text()).toContain('carpool.overview.billingHint')
    expect(wrapper.findComponent({ name: 'Line' }).props('data').datasets[0].data).toEqual([4])
  })
  it('shows a real empty state instead of sample numbers', async () => {
    get.mockResolvedValue({ data: { trend: [], models: [], users: [] } })
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('carpool.overview.noData')
    expect(wrapper.find('[data-test="line"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('$0.00')
    expect(button(wrapper, 'carpool.overview.export').attributes('disabled')).toBeDefined()
  })
  it('keeps aggregate data available if only the ranking fails', async () => {
    get.mockImplementation((url: string) => url.endsWith('snapshot-v2') ? Promise.resolve({ data: snapshot() }) : Promise.reject(new Error('private upstream detail')))
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('carpool.overview.rankingError')
    expect(wrapper.text()).toContain('$4.00')
    expect(wrapper.text()).not.toContain('private upstream detail')
    expect(wrapper.find('[data-test="line"]').exists()).toBe(true)
  })
  it('does not display a failed summary as zero usage and can retry', async () => {
    get.mockRejectedValueOnce(new Error('offline'))
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('carpool.overview.error')
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).not.toContain('$0.00')
    await button(wrapper, 'carpool.overview.retry').trigger('click'); await flushPromises()
    expect(wrapper.text()).not.toContain('carpool.overview.error')
  })
  it('requests server-side ranking order when the metric changes', async () => {
    const wrapper = render(); await flushPromises()
    await button(wrapper, 'carpool.overview.requests').trigger('click'); await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/admin/dashboard/user-breakdown', expect.objectContaining({ params: expect.objectContaining({ sort_by: 'requests' }) }))
    expect(wrapper.findComponent({ name: 'Line' }).props('data').datasets[0].data).toEqual([9])
  })
  it('cancels outdated requests and ignores late data after a newer filter', async () => {
    const old = deferred<{ data: { users: UserBreakdownItem[] } }>()
    get.mockImplementationOnce(() => Promise.resolve({ data: snapshot() })).mockImplementationOnce(() => old.promise)
    const wrapper = render()
    const oldSignal = get.mock.calls[0][1].signal as AbortSignal
    await wrapper.get('[data-testid="period"]').setValue('7d'); await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    old.resolve({ data: { users: [member(99)] } }); await flushPromises()
    expect(wrapper.text()).toContain('member1@example.com')
    expect(wrapper.text()).not.toContain('member99@example.com')
  })
  it('aborts the request when navigating away', () => {
    get.mockReturnValue(new Promise(() => {}))
    const wrapper = render()
    const signal = get.mock.calls[0][1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
  })
  it('validates custom dates before making any requests', async () => {
    const wrapper = render(); await flushPromises()
    await wrapper.get('[data-testid="period"]').setValue('custom')
    const count = get.mock.calls.length
    await wrapper.get('[data-testid="start-date"]').setValue('2026-10-29')
    await wrapper.get('[data-testid="end-date"]').setValue('2026-10-28')
    await wrapper.get('form').trigger('submit')
    expect(get).toHaveBeenCalledTimes(count)
    expect(wrapper.text()).toContain('carpool.overview.invalidRange')
  })
  it('searches only returned members and opens a member-scoped usage view', async () => {
    const wrapper = render(); await flushPromises()
    await button(wrapper, 'member1@example.com').trigger('click')
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ path: '/admin/usage', query: expect.objectContaining({ user_id: '1' }) }))
    await wrapper.get('[data-testid="member-search"]').setValue('missing')
    expect(wrapper.text()).toContain('carpool.overview.noMatches')
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('clearly indicates the Top 200 limit instead of an exact global member count', async () => {
    get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('snapshot-v2') ? snapshot() : { users: Array.from({ length: 200 }, (_, i) => member(i + 1)) } }))
    const wrapper = render(); await flushPromises()
    expect(wrapper.text()).toContain('≥ 200')
    expect(wrapper.text()).toContain('carpool.overview.truncated')
  })
  it('exports the returned ranking without causing any write request', async () => {
    const wrapper = render(); await flushPromises()
    await button(wrapper, 'carpool.overview.export').trigger('click')
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^carpool-top200-/))
    expect(get).toHaveBeenCalledTimes(2)
  })
})
