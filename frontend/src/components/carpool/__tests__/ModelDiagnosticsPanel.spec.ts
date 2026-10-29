import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import ModelDiagnosticsPanel from '../ModelDiagnosticsPanel.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn(), models: vi.fn(), run: vi.fn() }))
vi.mock('@/api/admin', () => ({ adminAPI: { accounts: { list: mocks.list, getAvailableModels: mocks.models } } }))
vi.mock('@/utils/modelDiagnostics', async () => {
  const actual = await vi.importActual<typeof import('@/utils/modelDiagnostics')>('@/utils/modelDiagnostics')
  return { ...actual, runModelDiagnostic: mocks.run }
})
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: ref('en') }) }))
const completed = { success: true, metrics: { rubric_id: 'json-arithmetic-v1', total_ms: 1200, first_token_ms: 200, output_tokens: 12, tokens_per_second: 12 }, quality: { score: 100, passed: { format: true, arithmetic: true, sorting: true } }, completedAt: '2026-10-28T16:00:00Z' }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
async function chooseModel(wrapper: ReturnType<typeof mount>) {
  await flushPromises()
  await wrapper.get('[data-testid="diagnostic-account"]').setValue('1')
  await flushPromises()
  await wrapper.get('[data-testid="diagnostic-model"]').setValue('gpt-5.4')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.list.mockResolvedValue({ items: [{ id: 1, name: 'Configured account', platform: 'openai', type: 'oauth' }, { id: 2, name: 'Other account', platform: 'anthropic', type: 'apikey' }], pages: 1 })
  mocks.models.mockResolvedValue([{ id: 'gpt-5.4', display_name: 'GPT' }])
  mocks.run.mockResolvedValue(completed)
})

describe('ModelDiagnosticsPanel safety and lifecycle', () => {
  it('does not run on mount or selection, and requires cost acknowledgement', async () => {
    const wrapper = mount(ModelDiagnosticsPanel)
    await chooseModel(wrapper)
    expect(mocks.run).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="diagnostic-run"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="diagnostic-confirm"]').setValue(true)
    await wrapper.get('[data-testid="diagnostic-run"]').trigger('click')
    await flushPromises()
    expect(mocks.run).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('100/100')
    expect(wrapper.get('[data-testid="diagnostic-run"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('clears measured values when a different account is selected', async () => {
    const wrapper = mount(ModelDiagnosticsPanel); await chooseModel(wrapper)
    await wrapper.get('[data-testid="diagnostic-confirm"]').setValue(true)
    await wrapper.get('[data-testid="diagnostic-run"]').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('100/100')
    await wrapper.get('[data-testid="diagnostic-account"]').setValue('2'); await flushPromises()
    expect(wrapper.get('[aria-labelledby="diagnostics-title"]').text()).toContain('modelDiagnostics.notMeasured')
    expect(mocks.run).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('blocks repeated clicks and ignores a late result after cancellation', async () => {
    const pending = deferred<typeof completed>(); mocks.run.mockReturnValue(pending.promise)
    const wrapper = mount(ModelDiagnosticsPanel)
    await chooseModel(wrapper)
    await wrapper.get('[data-testid="diagnostic-confirm"]').setValue(true)
    await wrapper.get('[data-testid="diagnostic-run"]').trigger('click')
    await wrapper.get('[data-testid="diagnostic-run"]').trigger('click')
    expect(mocks.run).toHaveBeenCalledTimes(1)
    const signal = mocks.run.mock.calls[0][2] as AbortSignal
    await wrapper.get('[data-testid="diagnostic-cancel"]').trigger('click')
    expect(signal.aborted).toBe(true)
    pending.resolve(completed); await flushPromises()
    expect(wrapper.text()).not.toContain('100/100')
    expect(wrapper.text()).toContain('modelDiagnostics.cancelled')
    wrapper.unmount()
  })
  it('does not let an older model-list response overwrite a new selection', async () => {
    const first = deferred<Array<{ id: string }>>(); mocks.models.mockImplementation((id: number) => id === 1 ? first.promise : Promise.resolve([{ id: 'claude-sonnet-4-6' }]))
    const wrapper = mount(ModelDiagnosticsPanel); await flushPromises()
    await wrapper.get('[data-testid="diagnostic-account"]').setValue('1')
    await wrapper.get('[data-testid="diagnostic-account"]').setValue('2'); await flushPromises()
    first.resolve([{ id: 'stale-model' }]); await flushPromises()
    const options = wrapper.get('[data-testid="diagnostic-model"]').text()
    expect(options).toContain('claude-sonnet-4-6'); expect(options).not.toContain('stale-model')
    wrapper.unmount()
  })
  it('aborts on unmount and never displays raw failures', async () => {
    const pending = deferred<typeof completed>(); mocks.run.mockReturnValue(pending.promise)
    const wrapper = mount(ModelDiagnosticsPanel); await chooseModel(wrapper)
    await wrapper.get('[data-testid="diagnostic-confirm"]').setValue(true); await wrapper.get('[data-testid="diagnostic-run"]').trigger('click')
    const signal = mocks.run.mock.calls[0][2] as AbortSignal
    wrapper.unmount(); expect(signal.aborted).toBe(true)
    pending.resolve(completed); await flushPromises()
    mocks.run.mockRejectedValue(new Error('secret-upstream-key'))
    const next = mount(ModelDiagnosticsPanel); await chooseModel(next)
    await next.get('[data-testid="diagnostic-confirm"]').setValue(true); await next.get('[data-testid="diagnostic-run"]').trigger('click'); await flushPromises()
    expect(next.text()).toContain('modelDiagnostics.errors.network'); expect(next.text()).not.toContain('secret-upstream-key')
    expect(next.text()).not.toContain('100/100'); next.unmount()
  })
})
