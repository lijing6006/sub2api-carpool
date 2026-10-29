<template>
  <section class="space-y-6" aria-labelledby="diagnostics-title">
    <div class="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 dark:border-blue-900/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">{{ t('modelDiagnostics.eyebrow') }}</p>
          <h2 id="diagnostics-title" class="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{{ t('modelDiagnostics.title') }}</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{{ t('modelDiagnostics.description') }}</p>
        </div>
        <span class="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">{{ t('modelDiagnostics.manualOnly') }}</span>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label for="diagnostic-account" class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ t('modelDiagnostics.account') }}</label>
          <select id="diagnostic-account" v-model="accountId" data-testid="diagnostic-account" class="input w-full" :disabled="running || accountsLoading" @change="loadModels">
            <option value="">{{ accountsLoading ? t('modelDiagnostics.loading') : t('modelDiagnostics.chooseAccount') }}</option>
            <option v-for="account in accounts" :key="account.id" :value="String(account.id)">{{ account.name }} · {{ account.platform }}</option>
          </select>
          <div class="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>{{ t('modelDiagnostics.accountScope') }}</span>
            <div v-if="accountPages > 1" class="flex shrink-0 items-center gap-2">
              <button type="button" class="rounded p-1 text-blue-600 disabled:opacity-30" :disabled="running || accountsLoading || accountPage <= 1" :aria-label="t('modelDiagnostics.previousPage')" @click="changeAccountPage(-1)">←</button>
              <span>{{ accountPage }} / {{ accountPages }}</span>
              <button type="button" class="rounded p-1 text-blue-600 disabled:opacity-30" :disabled="running || accountsLoading || accountPage >= accountPages" :aria-label="t('modelDiagnostics.nextPage')" @click="changeAccountPage(1)">→</button>
            </div>
          </div>
        </div>
        <div>
          <label for="diagnostic-model" class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ t('modelDiagnostics.model') }}</label>
          <select id="diagnostic-model" v-model="modelId" data-testid="diagnostic-model" class="input w-full" :disabled="running || modelsLoading || !accountId" @change="resetSelectionResult">
            <option value="">{{ modelsLoading ? t('modelDiagnostics.loading') : t('modelDiagnostics.chooseModel') }}</option>
            <option v-for="model in models" :key="model.id" :value="model.id">{{ model.display_name || model.id }} · {{ model.id }}</option>
          </select>
          <p class="mt-2 text-xs text-slate-500">{{ t('modelDiagnostics.modelScope') }}</p>
        </div>
      </div>
      <div v-if="metadataError" role="alert" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        <span>{{ t('modelDiagnostics.metadataError') }}</span>
        <button type="button" class="font-semibold underline" :disabled="running" @click="retryMetadata">{{ t('modelDiagnostics.retry') }}</button>
      </div>
      <p v-else-if="!accountsLoading && !accounts.length" class="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">{{ t('modelDiagnostics.noAccounts') }}</p>
      <p v-else-if="accountId && !modelsLoading && !models.length" class="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">{{ t('modelDiagnostics.noModels') }}</p>
      <div class="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
        <p class="text-sm font-medium text-amber-900 dark:text-amber-200">{{ t('modelDiagnostics.costWarning') }}</p>
        <p class="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">{{ t('modelDiagnostics.costDetail') }}</p>
        <label class="mt-3 flex cursor-pointer items-start gap-2 text-sm text-amber-950 dark:text-amber-100">
          <input v-model="confirmCost" data-testid="diagnostic-confirm" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-amber-300 text-blue-600" :disabled="running" />
          <span>{{ t('modelDiagnostics.confirmCost') }}</span>
        </label>
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="diagnostic-run" class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40" :disabled="!canRun" @click="startTest">
          <span v-if="running" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          {{ running ? t('modelDiagnostics.running') : t('modelDiagnostics.run') }}
        </button>
        <button v-if="running" type="button" data-testid="diagnostic-cancel" class="btn btn-secondary min-h-11" @click="cancelTest">{{ t('modelDiagnostics.cancel') }}</button>
        <span class="text-xs text-slate-500" role="status" aria-live="polite">{{ statusText }}</span>
      </div>
      <div v-if="runError" role="alert" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{{ runError }}</div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="metric in metricCards" :key="metric.key" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ metric.label }}</p>
        <p class="mt-3 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white" :class="metric.key === 'availability' && latest?.success ? 'text-emerald-600 dark:text-emerald-400' : ''">{{ metric.value }}</p>
        <p class="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">{{ metric.hint }}</p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-slate-900 dark:text-white">{{ t('modelDiagnostics.qualityTitle') }}</h3>
            <p class="mt-1 text-xs text-slate-500">{{ t('modelDiagnostics.qualityScope') }}</p>
          </div>
          <span class="rounded-lg bg-blue-50 px-3 py-1.5 text-lg font-semibold tabular-nums text-blue-700 dark:bg-blue-950 dark:text-blue-300">{{ latest?.quality ? `${latest.quality.score}/100` : '—' }}</span>
        </div>
        <div class="mt-5 space-y-3">
          <div v-for="check in checks" :key="check" class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <span class="text-sm text-slate-700 dark:text-slate-300">{{ t(`modelDiagnostics.checks.${check}`) }}</span>
            <span class="text-xs font-medium" :class="!latest?.quality ? 'text-slate-400' : latest.quality.passed[check] ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'">{{ !latest?.quality ? t('modelDiagnostics.notMeasured') : latest.quality.passed[check] ? t('modelDiagnostics.passed') : t('modelDiagnostics.notPassed') }}</span>
          </div>
        </div>
        <p class="mt-4 text-xs leading-5 text-slate-500">{{ t('modelDiagnostics.rubric') }}</p>
        <details class="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <summary class="cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-300">{{ t('modelDiagnostics.fixture') }}</summary>
          <p class="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 dark:text-slate-400">{{ DIAGNOSTIC_PROMPT }}</p>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{"sum":42,"sorted":[1,2,3]}</pre>
        </details>
      </div>
      <div class="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 dark:border-blue-900/40 dark:bg-blue-950/20 lg:col-span-2">
        <h3 class="font-semibold text-slate-900 dark:text-white">{{ t('modelDiagnostics.measurementTitle') }}</h3>
        <ul class="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
          <li>{{ t('modelDiagnostics.timingExplanation') }}</li>
          <li>{{ t('modelDiagnostics.tokensExplanation') }}</li>
          <li>{{ t('modelDiagnostics.privacyExplanation') }}</li>
          <li>{{ t('modelDiagnostics.limitsExplanation') }}</li>
        </ul>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
        <div>
          <h3 class="font-semibold text-slate-900 dark:text-white">{{ t('modelDiagnostics.historyTitle') }}</h3>
          <p class="mt-1 text-xs text-slate-500">{{ t('modelDiagnostics.historyScope') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-secondary text-xs" data-testid="diagnostic-export-json" :disabled="!history.length || running" @click="exportReport('json')">{{ t('modelDiagnostics.exportJson') }}</button>
          <button type="button" class="btn btn-secondary text-xs" data-testid="diagnostic-export-csv" :disabled="!history.length || running" @click="exportReport('csv')">{{ t('modelDiagnostics.exportCsv') }}</button>
          <button v-if="history.length" type="button" class="min-h-11 rounded-lg px-2 text-xs font-medium text-slate-500 hover:text-blue-600" data-testid="diagnostic-clear" :disabled="running" @click="history = []; exportError = false">{{ t('modelDiagnostics.clearHistory') }}</button>
        </div>
      </div>
      <p class="px-5 pt-3 text-xs leading-5 text-slate-500">{{ t('modelDiagnostics.exportPrivacy') }}</p>
      <p v-if="exportError" class="px-5 pt-3 text-sm text-red-700 dark:text-red-300" role="alert">{{ t('modelDiagnostics.exportError') }}</p>
      <div v-if="!history.length" class="px-6 py-12 text-center">
        <div class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-500 dark:bg-blue-950" aria-hidden="true">↗</div>
        <p class="text-sm text-slate-500">{{ t('modelDiagnostics.emptyHistory') }}</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50"><tr><th class="px-5 py-3">{{ t('modelDiagnostics.account') }}</th><th class="px-5 py-3">{{ t('modelDiagnostics.model') }}</th><th class="px-5 py-3">{{ t('modelDiagnostics.total') }}</th><th class="px-5 py-3">{{ t('modelDiagnostics.qualityTitle') }}</th><th class="px-5 py-3">{{ t('modelDiagnostics.completed') }}</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800"><tr v-for="(item, index) in history" :key="`${item.completedAt}-${index}`"><td class="px-5 py-4 text-slate-700 dark:text-slate-300">{{ item.accountName }}<p class="mt-1 text-xs text-slate-500">{{ t(`modelDiagnostics.outcomes.${item.outcome}`) }}</p></td><td class="px-5 py-4 font-mono text-xs text-slate-500">{{ item.model }}</td><td class="px-5 py-4 tabular-nums text-slate-700 dark:text-slate-300">{{ duration(item.metrics?.total_ms) }}</td><td class="px-5 py-4 tabular-nums text-blue-700 dark:text-blue-300">{{ item.quality ? `${item.quality.score}/100` : t('modelDiagnostics.notMeasured') }}</td><td class="px-5 py-4 text-xs text-slate-500">{{ new Date(item.completedAt).toLocaleTimeString(locale) }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { ClaudeModel } from '@/types'
import { DIAGNOSTIC_PROMPT, isDiagnosticTextModel, ModelDiagnosticError, runModelDiagnostic, downloadDiagnosticReport, type DiagnosticHistoryItem, type DiagnosticCheck, type DiagnosticResult } from '@/utils/modelDiagnostics'

const { t, locale } = useI18n()
type DiagnosticAccount = { id: number; name: string; platform: string }
const accounts = ref<DiagnosticAccount[]>([])
const models = ref<ClaudeModel[]>([])
const accountId = ref('')
const modelId = ref('')
const accountsLoading = ref(false)
const modelsLoading = ref(false)
const metadataError = ref<'accounts' | 'models' | null>(null)
const accountPage = ref(1)
const accountPages = ref(1)
const confirmCost = ref(false)
const running = ref(false)
const cancelled = ref(false)
const runError = ref('')
const latest = ref<DiagnosticResult | null>(null)
const history = ref<DiagnosticHistoryItem[]>([])
const exportError = ref(false)
const checks: DiagnosticCheck[] = ['format', 'arithmetic', 'sorting']
let metadataSequence = 0
let runSequence = 0
let controller: AbortController | null = null
let unmounted = false
const canRun = computed(() => !!accountId.value && !!modelId.value && confirmCost.value && !running.value && !modelsLoading.value && !accountsLoading.value && !metadataError.value)
const statusText = computed(() => running.value ? t('modelDiagnostics.runningHint') : cancelled.value ? t('modelDiagnostics.cancelled') : latest.value ? t('modelDiagnostics.completedHint') : t('modelDiagnostics.idleHint'))
const duration = (milliseconds: number | null | undefined) => milliseconds == null ? '—' : `${(milliseconds / 1000).toFixed(2)} s`
const metricCards = computed(() => [
  { key: 'availability', label: t('modelDiagnostics.availability'), value: latest.value ? latest.value.success ? t('modelDiagnostics.available') : t('modelDiagnostics.unavailable') : '—', hint: t('modelDiagnostics.availabilityHint') },
  { key: 'ttft', label: t('modelDiagnostics.ttft'), value: duration(latest.value?.metrics?.first_token_ms), hint: t('modelDiagnostics.ttftHint') },
  { key: 'total', label: t('modelDiagnostics.total'), value: duration(latest.value?.metrics?.total_ms), hint: t('modelDiagnostics.totalHint') },
  { key: 'tokens', label: t('modelDiagnostics.throughput'), value: latest.value?.metrics?.tokens_per_second != null ? `${latest.value.metrics.tokens_per_second.toFixed(1)} tok/s` : '—', hint: latest.value?.metrics?.output_tokens != null ? t('modelDiagnostics.outputTokens', { count: latest.value.metrics.output_tokens }) : t('modelDiagnostics.tokensUnavailable') }
])

async function loadAccounts() {
  const sequence = ++metadataSequence
  accountsLoading.value = true
  metadataError.value = null
  accountId.value = ''
  modelId.value = ''
  models.value = []
  resetSelectionResult()
  try {
    const response = await adminAPI.accounts.list(accountPage.value, 100, { lite: '1' })
    if (sequence !== metadataSequence || unmounted) return
    accounts.value = response.items.filter(account => ['anthropic', 'openai', 'gemini'].includes(account.platform) && account.type !== 'bedrock').map(({ id, name, platform }) => ({ id, name, platform }))
    accountPages.value = Math.max(1, response.pages || 1)
  } catch {
    if (sequence !== metadataSequence || unmounted) return
    accounts.value = []
    metadataError.value = 'accounts'
  } finally {
    if (sequence === metadataSequence && !unmounted) accountsLoading.value = false
  }
}
async function loadModels() {
  const sequence = ++metadataSequence
  modelId.value = ''
  models.value = []
  resetSelectionResult()
  metadataError.value = null
  if (!accountId.value) { modelsLoading.value = false; return }
  modelsLoading.value = true
  try {
    const response = await adminAPI.accounts.getAvailableModels(Number(accountId.value))
    if (sequence !== metadataSequence || unmounted) return
    models.value = response.filter(model => isDiagnosticTextModel(model.id))
  } catch {
    if (sequence !== metadataSequence || unmounted) return
    metadataError.value = 'models'
  } finally {
    if (sequence === metadataSequence && !unmounted) modelsLoading.value = false
  }
}
function resetSelectionResult() { confirmCost.value = false; latest.value = null; runError.value = ''; cancelled.value = false }
function changeAccountPage(delta: number) { accountPage.value += delta; void loadAccounts() }
function retryMetadata() { if (metadataError.value === 'models') void loadModels(); else void loadAccounts() }
async function startTest() {
  if (!canRun.value) return
  const sequence = ++runSequence
  const account = accounts.value.find(item => item.id === Number(accountId.value))
  if (!account) return
  const model = modelId.value
  controller = new AbortController()
  const currentController = controller
  const timeout = window.setTimeout(() => currentController.abort(), 65000)
  running.value = true
  cancelled.value = false
  runError.value = ''
  latest.value = null
  try {
    const result = await runModelDiagnostic(account.id, model, currentController.signal)
    if (sequence !== runSequence || unmounted) return
    latest.value = result
    history.value = [{ ...result, accountId: account.id, accountName: account.name, model, outcome: 'completed' as const }, ...history.value].slice(0, 8)
    if (!result.success) runError.value = t('modelDiagnostics.errors.request')
  } catch (error) {
    if (sequence !== runSequence || unmounted) return
    history.value = [{ success: false, metrics: null, quality: null, completedAt: new Date().toISOString(), accountId: account.id, accountName: account.name, model, outcome: 'failed' as const }, ...history.value].slice(0, 8)
    runError.value = error instanceof ModelDiagnosticError ? t(`modelDiagnostics.errors.${error.kind}`) : currentController.signal.aborted ? t('modelDiagnostics.errors.timeout') : t('modelDiagnostics.errors.network')
  } finally {
    window.clearTimeout(timeout)
    if (sequence === runSequence && !unmounted) { running.value = false; confirmCost.value = false; controller = null }
  }
}
function exportReport(format: 'json' | 'csv') {
  if (running.value || !history.value.length) return
  exportError.value = false
  try { downloadDiagnosticReport(history.value, format) } catch { exportError.value = true }
}
function cancelTest() {
  const account = accounts.value.find(item => item.id === Number(accountId.value))
  if (running.value && account) history.value = [{ success: false, metrics: null, quality: null, completedAt: new Date().toISOString(), accountId: account.id, accountName: account.name, model: modelId.value, outcome: 'cancelled' as const }, ...history.value].slice(0, 8)
  ++runSequence
  controller?.abort()
  controller = null
  running.value = false
  confirmCost.value = false
  cancelled.value = true
}
onMounted(loadAccounts)
onBeforeUnmount(() => { unmounted = true; ++metadataSequence; ++runSequence; controller?.abort() })
</script>
