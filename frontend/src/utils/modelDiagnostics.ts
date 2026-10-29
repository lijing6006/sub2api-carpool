import { buildApiUrl } from '@/api/url'
import { ADMIN_UI_REQUEST_HEADER } from '@/api/adminUIRequest'

export const DIAGNOSTIC_RUBRIC_ID = 'json-arithmetic-v1'
export const DIAGNOSTIC_PROMPT = 'Reply with only one JSON object, no Markdown or explanation. Compute 17 + 25 and return the answer as the numeric value of "sum". Sort [3, 1, 2] ascending and return it as "sorted". Use exactly these two keys.'
export type DiagnosticCheck = 'format' | 'arithmetic' | 'sorting'
export interface DiagnosticQuality {
  passed: Record<DiagnosticCheck, boolean>
  score: number
}
export interface DiagnosticMetrics {
  rubric_id: string
  total_ms: number
  first_token_ms: number | null
  output_tokens: number | null
  tokens_per_second: number | null
}
export interface DiagnosticResult {
  success: boolean
  metrics: DiagnosticMetrics | null
  quality: DiagnosticQuality | null
  completedAt: string
}
export type DiagnosticFailure = 'unauthorized' | 'request' | 'network' | 'incomplete' | 'outputLimit' | 'unsupported'
export class ModelDiagnosticError extends Error {
  constructor(public readonly kind: DiagnosticFailure) { super(kind) }
}

export function isDiagnosticTextModel(model: string): boolean {
  return !!model.trim() && model.length <= 200 && !/[\r\n\0]|image|video|audio|realtime|embedding|tts|stt|dall-e|sora|whisper|speech/i.test(model)
}

/** This checks one published fixture, never model intelligence or latency. */
export function evaluateDiagnosticFixture(output: string): DiagnosticQuality {
  const passed = { format: false, arithmetic: false, sorting: false }
  try {
    const value: unknown = JSON.parse(output.trim())
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const object = value as Record<string, unknown>
      passed.format = Object.keys(object).sort().join(',') === 'sorted,sum'
      passed.arithmetic = object.sum === 42
      passed.sorting = Array.isArray(object.sorted) && object.sorted.length === 3 && object.sorted.every((value, index) => value === index + 1)
    }
  } catch { /* Malformed output does not pass the strict JSON fixture. */ }
  return { passed, score: Math.round(Object.values(passed).filter(Boolean).length / 3 * 100) }
}

function readMetrics(value: unknown): DiagnosticMetrics | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (data.rubric_id !== DIAGNOSTIC_RUBRIC_ID || typeof data.total_ms !== 'number' || !Number.isFinite(data.total_ms) || data.total_ms < 0) return null
  const nullableNumber = (key: string): number | null => typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0 ? data[key] as number : null
  const rawFirst = nullableNumber('first_token_ms')
  const rawTokens = nullableNumber('output_tokens')
  const first = rawFirst !== null && rawFirst <= data.total_ms ? rawFirst : null
  const tokens = rawTokens !== null && Number.isInteger(rawTokens) ? rawTokens : null
  return {
    rubric_id: DIAGNOSTIC_RUBRIC_ID,
    total_ms: data.total_ms,
    first_token_ms: first,
    output_tokens: tokens,
    tokens_per_second: tokens !== null && tokens > 0 && first !== null && first < data.total_ms ? nullableNumber('tokens_per_second') : null
  }
}

/** Calls only the existing authenticated admin test API, never a provider URL.
 * The caller must obtain an explicit cost confirmation before invoking this.
 * Provider error bodies and generated text are intentionally not returned.
 */
export async function runModelDiagnostic(accountId: number, modelId: string, signal: AbortSignal): Promise<DiagnosticResult> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !isDiagnosticTextModel(modelId)) throw new ModelDiagnosticError('request')
  const token = localStorage.getItem('auth_token')
  if (!token) throw new ModelDiagnosticError('unauthorized')
  const response = await fetch(buildApiUrl(`/admin/accounts/${accountId}/test`), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', [ADMIN_UI_REQUEST_HEADER]: '1' },
    body: JSON.stringify({ mode: 'diagnostic', model_id: modelId, confirm_cost: true }),
    signal
  })
  if (!response.ok) throw new ModelDiagnosticError(response.status === 401 || response.status === 403 ? 'unauthorized' : 'request')
  if (!response.body) throw new ModelDiagnosticError('incomplete')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let dataLines: string[] = []
  let dataBytes = 0
  let text = ''
  let result: DiagnosticResult | null = null
  const handleEvent = () => {
    if (!dataLines.length) return
    const raw = dataLines.join('\n')
    dataLines = []
    dataBytes = 0
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { throw new ModelDiagnosticError('incomplete') }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ModelDiagnosticError('incomplete')
    const event = parsed as Record<string, unknown>
    if (event.type === 'content' && typeof event.text === 'string') {
      text += event.text
      if (text.length > 8192) throw new ModelDiagnosticError('outputLimit')
    }
    if (event.type === 'error') throw new ModelDiagnosticError('request')
    if (event.type === 'test_complete') {
      const metrics = readMetrics(event.metrics)
      // An older backend ignores mode=diagnostic. Do not score its "hi" probe.
      if (!metrics) throw new ModelDiagnosticError('unsupported')
      const success = event.success === true && text.trim().length > 0
      result = { success, metrics, quality: success ? evaluateDiagnosticFixture(text) : null, completedAt: new Date().toISOString() }
    }
  }
  const handleLine = (line: string) => {
    const clean = line.replace(/\r$/, '')
    if (clean === '') handleEvent()
    else if (clean.startsWith('data:')) {
      dataBytes += clean.length
      if (dataBytes > 65536) throw new ModelDiagnosticError('outputLimit')
      dataLines.push(clean.slice(5).replace(/^ /, ''))
    }
  }
  try {
    while (!result) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const { done, value } = await reader.read()
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
      if (pending.length > 65536) throw new ModelDiagnosticError('outputLimit')
      let newline: number
      while ((newline = pending.indexOf('\n')) >= 0) {
        handleLine(pending.slice(0, newline))
        pending = pending.slice(newline + 1)
        if (result) break
      }
      if (done) {
        if (pending) handleLine(pending)
        handleEvent()
        break
      }
    }
    if (!result) throw new ModelDiagnosticError('incomplete')
    return result
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

export type DiagnosticOutcome = 'completed' | 'failed' | 'cancelled'
export interface DiagnosticHistoryItem extends DiagnosticResult {
  accountId: number
  accountName: string
  model: string
  outcome: DiagnosticOutcome
}

// Explicit allowlist: never spread account objects, prompts, provider bodies or errors into exports.
export function diagnosticSessionReport(history: DiagnosticHistoryItem[], generatedAt = new Date().toISOString()) {
  const numberOrNull = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  return {
    schema: 'sub2api-carpool-diagnostics-v1',
    generated_at: generatedAt,
    scope: 'current-browser-session-only',
    notes: [
      '固定小题检查，不代表模型通用质量。Fixed-fixture checks are not a general quality benchmark.',
      '延迟由网关观察，吞吐仅使用上游报告的 Token。Gateway-observed timing; throughput uses provider-reported tokens only.',
      '取消和失败仍可能产生上游费用。Cancelled or failed requests may still incur upstream cost.',
      '不含提示词、响应正文或凭据。No prompts, response bodies or credentials are exported.'
    ],
    runs: history.slice(0, 8).map(item => ({
      account_id: item.accountId,
      account_name: item.accountName,
      model: item.model,
      completed_at: item.completedAt,
      outcome: item.outcome,
      available: item.outcome === 'completed' ? item.success : null,
      first_text_ms: numberOrNull(item.metrics?.first_token_ms),
      total_ms: numberOrNull(item.metrics?.total_ms),
      output_tokens: numberOrNull(item.metrics?.output_tokens),
      tokens_per_second: numberOrNull(item.metrics?.tokens_per_second),
      rubric_id: DIAGNOSTIC_RUBRIC_ID,
      fixture_score: item.quality ? numberOrNull(item.quality.score) : null,
      format_passed: item.quality?.passed.format ?? null,
      arithmetic_passed: item.quality?.passed.arithmetic ?? null,
      sorting_passed: item.quality?.passed.sorting ?? null
    }))
  }
}

export function diagnosticSessionCsv(history: DiagnosticHistoryItem[]): string {
  const rows = diagnosticSessionReport(history).runs
  const columns = ['account_id', 'account_name', 'model', 'completed_at', 'outcome', 'available', 'first_text_ms', 'total_ms', 'output_tokens', 'tokens_per_second', 'rubric_id', 'fixture_score', 'format_passed', 'arithmetic_passed', 'sorting_passed'] as const
  const cell = (value: string | number | boolean | null) => {
    let text = value === null ? '' : String(value)
    if (typeof value === 'string' && (/^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text))) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n')
}

export function downloadDiagnosticReport(history: DiagnosticHistoryItem[], format: 'json' | 'csv'): void {
  if (!history.length) return
  const report = diagnosticSessionReport(history)
  const blob = new Blob([format === 'json' ? JSON.stringify(report, null, 2) : diagnosticSessionCsv(history)], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `carpool-diagnostics-${report.generated_at.slice(0, 10)}.${format}`
  link.hidden = true
  try { document.body.appendChild(link); link.click() } finally {
    link.remove()
    // Let the browser consume the download before releasing its object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
