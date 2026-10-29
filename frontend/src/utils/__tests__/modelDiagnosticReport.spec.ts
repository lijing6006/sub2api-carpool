import { afterEach, describe, expect, it, vi } from 'vitest'
import { diagnosticSessionCsv, diagnosticSessionReport, downloadDiagnosticReport, type DiagnosticHistoryItem } from '../modelDiagnostics'
const sample = (): DiagnosticHistoryItem => ({ accountId: 9, accountName: 'Shared account', model: 'configured-model', outcome: 'completed', success: true, completedAt: '2026-10-28T17:00:00Z', metrics: { rubric_id: 'json-arithmetic-v1', total_ms: 1000, first_token_ms: 200, output_tokens: 8, tokens_per_second: 10 }, quality: { score: 100, passed: { format: true, arithmetic: true, sorting: true } } })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
describe('diagnostic report privacy and downloads', () => {
  it('exports an explicit field allowlist and transparent limitations', () => {
    const source = { ...sample(), api_key: 'private-key', prompt: 'private-prompt', response: 'private-response', credentials: { token: 'private-token' } }
    const report = diagnosticSessionReport([source], '2026-10-28T18:00:00Z')
    expect(report.schema).toBe('sub2api-carpool-diagnostics-v1')
    expect(report.runs[0]).toEqual({ account_id: 9, account_name: 'Shared account', model: 'configured-model', completed_at: source.completedAt, outcome: 'completed', available: true, first_text_ms: 200, total_ms: 1000, output_tokens: 8, tokens_per_second: 10, rubric_id: 'json-arithmetic-v1', fixture_score: 100, format_passed: true, arithmetic_passed: true, sorting_passed: true })
    expect(JSON.stringify(report)).not.toContain('private-')
    expect(report.notes.join(' ')).toContain('not a general quality benchmark')
  })
  it.each(['failed', 'cancelled'] as const)('keeps unknown metrics and availability unknown for %s', outcome => {
    const row = diagnosticSessionReport([{ ...sample(), outcome, success: false, metrics: null, quality: null }]).runs[0]!
    expect(row.available).toBeNull(); expect(row.first_text_ms).toBeNull(); expect(row.fixture_score).toBeNull()
    const csv = diagnosticSessionCsv([{ ...sample(), outcome, metrics: null, quality: null }])
    expect(csv).not.toContain('NaN'); expect(csv).toContain('"","","","",""')
  })
  it('limits session data to eight runs and rejects nonfinite metrics', () => {
    const rows = diagnosticSessionReport(Array.from({ length: 20 }, () => ({ ...sample(), metrics: { ...sample().metrics!, total_ms: Infinity, first_token_ms: -1 } }))).runs
    expect(rows).toHaveLength(8); expect(rows[0]!.total_ms).toBeNull(); expect(rows[0]!.first_text_ms).toBeNull()
  })
  it('protects spreadsheet formulas, quotes and embedded newlines', () => {
    const csv = diagnosticSessionCsv([{ ...sample(), accountName: '=SUM(1,2)', model: '\t@unsafe"\nmodel' }])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"\'=SUM(1,2)"')
    expect(csv).toContain('"\'\t@unsafe""\nmodel"')
    expect(csv).not.toContain('private-prompt')
  })
  it('does not create a download for empty history', () => {
    const createObjectURL = vi.fn(); vi.stubGlobal('URL', { createObjectURL })
    downloadDiagnosticReport([], 'json'); expect(createObjectURL).not.toHaveBeenCalled()
  })
  it('cleans up the download element and eventually revokes the object URL', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:diagnostic-test'); const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^carpool-diagnostics-\d{4}-\d{2}-\d{2}\.json$/)
      expect(document.body.contains(this)).toBe(true)
    })
    downloadDiagnosticReport([sample()], 'json')
    expect(click).toHaveBeenCalledTimes(1); expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(document.querySelector('a[download]')).toBeNull()
    vi.runAllTimers(); expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostic-test')
  })
  it('also cleans up if the browser cannot start the download', () => {
    vi.useFakeTimers(); const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('download blocked') })
    expect(() => downloadDiagnosticReport([sample()], 'csv')).toThrow('download blocked')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.runAllTimers(); expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
