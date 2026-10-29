import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DIAGNOSTIC_RUBRIC_ID, evaluateDiagnosticFixture, isDiagnosticTextModel, ModelDiagnosticError, runModelDiagnostic } from '../modelDiagnostics'

const metadata = { rubric_id: DIAGNOSTIC_RUBRIC_ID, total_ms: 1000, first_token_ms: 250, output_tokens: 15, tokens_per_second: 20 }
function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk))); controller.close() } }), { headers: { 'Content-Type': 'text/event-stream' } })
}
const completion = (metrics: unknown = metadata) => `data: ${JSON.stringify({ type: 'test_complete', success: true, metrics })}\n\n`
const content = 'data: {"type":"content","text":"{\\"sum\\":42,\\"sorted\\":[1,2,3]}"}\n\n'

describe('model diagnostics fixture and stream', () => {
  beforeEach(() => { localStorage.setItem('auth_token', 'mock-admin-token') })
  afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })
  it('scores only published JSON checks, not response speed', () => {
    expect(evaluateDiagnosticFixture('{"sum":42,"sorted":[1,2,3]}')).toEqual({ score: 100, passed: { format: true, arithmetic: true, sorting: true } })
    expect(evaluateDiagnosticFixture('{"sum":"42","sorted":[1,2,3]}').score).toBe(67)
    expect(evaluateDiagnosticFixture('{"sum":42,"sorted":[1,2,3],"extra":true}').score).toBe(67)
    expect(evaluateDiagnosticFixture('```json\n{"sum":42,"sorted":[1,2,3]}\n```').score).toBe(0)
    expect(evaluateDiagnosticFixture('null').score).toBe(0)
  })
  it('excludes non-text models', () => {
    expect(isDiagnosticTextModel('gpt-5.4')).toBe(true)
    for (const name of ['gpt-image-1', 'grok-video', 'tts-1', 'text-embedding-3', 'model\nheader']) expect(isDiagnosticTextModel(name)).toBe(false)
  })
  it('requires auth without sending a request', async () => {
    localStorage.clear()
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('sends only the fixed diagnostic mode and consumes split CRLF/tail SSE', async () => {
    const text = content.replaceAll('\n', '\r\n') + completion().trimEnd()
    const fetch = vi.fn().mockResolvedValue(streamResponse([text.slice(0, 20), text.slice(20, 90), text.slice(90)])); vi.stubGlobal('fetch', fetch)
    const result = await runModelDiagnostic(12, 'gpt-5.4', new AbortController().signal)
    expect(result.quality?.score).toBe(100)
    expect(result.metrics).toEqual(metadata)
    expect(result).not.toHaveProperty('output')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ mode: 'diagnostic', model_id: 'gpt-5.4', confirm_cost: true })
    expect(fetch.mock.calls[0][1].headers['X-Admin-UI-Request']).toBe('1')
  })
  it('never estimates tokens when provider usage is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([content, completion({ ...metadata, output_tokens: null, tokens_per_second: null })])))
    const result = await runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)
    expect(result.metrics?.output_tokens).toBeNull()
    expect(result.metrics?.tokens_per_second).toBeNull()
  })
  it('rejects old backends without scoring a hi probe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(['data: {"type":"content","text":"hello"}\n\n', completion(undefined).replace(/,"metrics":\{[^}]+\}/, '')])))
    await expect(runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).rejects.toMatchObject({ kind: 'unsupported' })
  })
  it('does not treat truncated content as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([content])))
    await expect(runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).rejects.toMatchObject({ kind: 'incomplete' })
  })
  it('never exposes provider error text or credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(['data: {"type":"error","error":"Authorization: Bearer secret"}\n\n'])))
    try { await runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal); expect.fail('must fail') } catch (error) {
      expect(error).toBeInstanceOf(ModelDiagnosticError)
      expect(String(error)).not.toContain('secret')
    }
  })
  it('rejects overlong output and validates metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([`data: ${JSON.stringify({ type: 'content', text: 'a'.repeat(8193) })}\n\n` ])))
    await expect(runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).rejects.toMatchObject({ kind: 'outputLimit' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([content, completion({ ...metadata, first_token_ms: 2000, output_tokens: 2.5 })])))
    const result = await runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)
    expect(result.metrics?.first_token_ms).toBeNull()
    expect(result.metrics?.output_tokens).toBeNull()
    expect(result.metrics?.tokens_per_second).toBeNull()
  })
  it('never starts an already-cancelled request', async () => {
    const controller = new AbortController(); controller.abort()
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(runModelDiagnostic(1, 'gpt-5.4', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects malformed or unbounded multi-line SSE events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(['data: null\n\n'])))
    await expect(runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).rejects.toMatchObject({ kind: 'incomplete' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(Array.from({ length: 70 }, () => `data: ${'a'.repeat(1000)}\n`))))
    await expect(runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).rejects.toMatchObject({ kind: 'outputLimit' })
  })
  it('does not score an unsuccessful completed request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([content, completion().replace('"success":true', '"success":false')])))
    expect((await runModelDiagnostic(1, 'gpt-5.4', new AbortController().signal)).quality).toBeNull()
  })
})
