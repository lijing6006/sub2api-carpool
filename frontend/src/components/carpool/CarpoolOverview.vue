<template>
  <section class="space-y-5" :aria-busy="loading">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{{ t('carpool.overview.title') }}</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ t('carpool.overview.subtitle') }}</p></div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="sr-only" for="carpool-period">{{ t('carpool.overview.period') }}</label>
        <select id="carpool-period" v-model="period" class="input w-auto" data-testid="period">
          <option v-for="option in periods" :key="option" :value="option">{{ t(`carpool.overview.periods.${option}`) }}</option>
        </select>
        <button class="btn btn-secondary" :disabled="loading" @click="loadData">{{ loading ? t('carpool.overview.refreshing') : t('carpool.overview.refresh') }}</button>
      </div>
    </div>

    <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ t(queryError ? 'carpool.overview.filterLinkError' : 'carpool.overview.filterLinkHint') }}</p>

    <form v-if="period === 'custom'" class="cp-panel flex flex-wrap items-end gap-3 p-4" @submit.prevent="applyCustomRange">
      <label class="text-sm text-slate-600 dark:text-slate-300">{{ t('carpool.overview.start') }}<input v-model="draftStart" type="date" required class="input mt-1" data-testid="start-date"></label>
      <label class="text-sm text-slate-600 dark:text-slate-300">{{ t('carpool.overview.end') }}<input v-model="draftEnd" type="date" required class="input mt-1" data-testid="end-date"></label>
      <button class="cp-primary" type="submit">{{ t('carpool.overview.apply') }}</button>
      <p v-if="rangeError" class="w-full text-sm text-red-600" role="alert">{{ t('carpool.overview.invalidRange') }}</p>
    </form>

    <div v-if="dataError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" role="alert">
      {{ t('carpool.overview.error') }} <button class="ml-2 font-semibold underline" @click="loadData">{{ t('carpool.overview.retry') }}</button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="card in summaryCards" :key="card.key" class="cp-panel p-5">
        <div class="flex items-start gap-4"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" :class="card.color" aria-hidden="true"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="card.icon" /></svg></span>
          <div class="min-w-0"><p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ t(`carpool.overview.${card.key}`) }}</p><div v-if="loading" class="mt-2 h-8 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-700" /><p v-else class="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{{ card.value }}</p></div>
        </div>
        <p class="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ t(`carpool.overview.${card.hint}`) }}</p>
      </article>
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
      <article class="cp-panel min-w-0 p-5 sm:p-6">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 class="cp-heading">{{ t('carpool.overview.trend') }}</h3><p class="mt-1 text-xs text-slate-500">{{ startDate }} — {{ endDate }}</p></div>
          <div class="cp-segments" :aria-label="t('carpool.overview.metric')"><button v-for="item in metrics" :key="item" :class="{ selected: metric === item }" :aria-pressed="metric === item" @click="metric = item">{{ t(`carpool.overview.${item}`) }}</button></div>
        </div>
        <div v-if="loading" class="h-64 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-800" />
        <div v-else-if="snapshot && snapshot.trend?.length" class="h-64"><Line :data="trendChart" :options="lineOptions" :aria-label="t('carpool.overview.trend')" role="img" /></div>
        <div v-else class="cp-empty h-64"><p>{{ t(dataError ? 'carpool.overview.unknown' : 'carpool.overview.noData') }}</p><p class="mt-2 max-w-sm text-xs">{{ t('carpool.overview.noDataHint') }}</p></div>
        <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">{{ t('carpool.overview.trendHint') }}</p>
        <details v-if="!loading && snapshot?.trend?.length" class="mt-4 rounded-xl border border-slate-100 p-3 dark:border-slate-800" data-testid="trend-details">
          <summary class="min-h-8 cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-300">{{ t('carpool.overview.dailyDetails') }}</summary>
          <p class="mt-2 text-xs leading-5 text-slate-500">{{ t('carpool.overview.dailyDetailsHint') }}</p>
          <button type="button" class="btn btn-secondary my-3 min-h-11 text-xs" data-testid="export-trend" @click="exportTrend">{{ t('carpool.overview.exportTrend') }}</button>
          <div class="max-h-72 overflow-auto rounded-lg border border-slate-100 dark:border-slate-800" tabindex="0" :aria-label="t('carpool.overview.dailyDetails')">
            <table class="w-full min-w-[460px] text-right text-xs">
              <caption class="sr-only">{{ t('carpool.overview.dailyDetails') }} · {{ startDate }} — {{ endDate }}</caption>
              <thead class="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th scope="col" class="p-3 text-left">{{ t('carpool.overview.date') }}</th><th v-for="item in metrics" :key="item" scope="col" class="p-3">{{ t(`carpool.overview.${item}`) }}</th></tr></thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800"><tr v-for="day in snapshot.trend" :key="day.date"><th scope="row" class="p-3 text-left font-normal text-slate-600 dark:text-slate-300">{{ day.date }}</th><td class="p-3 tabular-nums">{{ money(day.actual_cost) }}</td><td class="p-3 tabular-nums">{{ day.total_tokens.toLocaleString(locale) }}</td><td class="p-3 tabular-nums">{{ day.requests.toLocaleString(locale) }}</td></tr></tbody>
            </table>
          </div>
        </details>
      </article>

      <article class="cp-panel min-w-0 p-5 sm:p-6">
        <h3 class="cp-heading">{{ t('carpool.overview.models') }}</h3><p class="mt-1 text-xs text-slate-500">{{ t('carpool.overview.modelsHint') }}</p>
        <div v-if="loading" class="mx-auto my-8 h-40 w-40 animate-pulse rounded-full bg-slate-50 dark:bg-slate-800" />
        <template v-else-if="modelItems.length"><div class="relative mx-auto my-5 h-44 max-w-[220px]"><Doughnut :data="modelChart" :options="doughnutOptions" :aria-label="t('carpool.overview.models')" role="img" /></div>
          <ul class="space-y-2.5"><li v-for="(model, index) in modelItems" :key="model.model" class="flex items-center gap-2 text-xs"><span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: palette[index] }" /><span class="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300" :title="model.model">{{ model.model }}</span><span class="font-medium tabular-nums text-slate-900 dark:text-white">{{ money(model.actual_cost) }}</span></li></ul>
        </template>
        <div v-else class="cp-empty h-64">{{ t(dataError ? 'carpool.overview.unknown' : 'carpool.overview.noData') }}</div>
      </article>
    </div>

    <article class="cp-panel overflow-hidden">
      <div class="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div><h3 class="cp-heading">{{ t('carpool.overview.ranking') }}</h3><p class="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ t('carpool.overview.rankingHint') }}</p></div>
        <button class="btn btn-secondary" :disabled="loading || rankingError || !ranking.length" :title="t('carpool.overview.csvNotice')" @click="exportRanking">{{ t('carpool.overview.export') }}</button>
        <label class="w-full sm:max-w-xs"><span class="sr-only">{{ t('carpool.overview.search') }}</span><input v-model="search" class="input" type="search" :placeholder="t('carpool.overview.searchHint')" data-testid="member-search"></label>
      </div>
      <div v-if="rankingError" class="mx-5 mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="alert">{{ t('carpool.overview.rankingError') }} <button class="font-semibold underline" @click="loadData">{{ t('carpool.overview.retry') }}</button></div>
      <div v-else-if="loading" class="mx-5 mb-5 h-48 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-800" />
      <div v-else-if="filteredRanking.length" class="overflow-x-auto">
        <table class="w-full min-w-[680px] text-left text-sm"><thead class="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70"><tr><th class="px-5 py-3 font-medium">{{ t('carpool.overview.rank') }}</th><th class="px-3 py-3 font-medium">{{ t('carpool.overview.member') }}</th><th v-for="item in metrics" :key="item" class="px-3 py-3 text-right font-medium" :aria-sort="metric === item ? 'descending' : 'none'"><button class="whitespace-nowrap" :class="{ 'text-blue-600 dark:text-blue-400': metric === item }" @click="metric = item">{{ t(`carpool.overview.${item}`) }} <span v-if="metric === item" aria-hidden="true">↓</span></button></th><th class="px-5 py-3 text-right font-medium">{{ t('carpool.overview.share') }}</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800"><tr v-for="row in filteredRanking" :key="row.user_id" class="transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20"><td class="px-5 py-4"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold" :class="row.rank <= 3 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-500'">{{ row.rank }}</span></td><td class="px-3 py-4"><button class="max-w-[240px] truncate text-left font-medium text-slate-800 hover:text-blue-600 dark:text-slate-200" :title="t('carpool.overview.details')" @click="openUsage(row.user_id)">{{ row.email || `#${row.user_id}` }}</button><p class="mt-0.5 text-xs text-slate-400">ID {{ row.user_id }}</p></td><td class="px-3 py-4 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">{{ money(row.actual_cost) }}</td><td class="px-3 py-4 text-right tabular-nums text-slate-500 dark:text-slate-400">{{ compact(row.total_tokens) }}</td><td class="px-3 py-4 text-right tabular-nums text-slate-500 dark:text-slate-400">{{ compact(row.requests) }}</td><td class="px-5 py-4 text-right"><span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ share(row[metric]) }}</span><div class="mt-1.5 ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-blue-500" :style="{ width: `${shareValue(row[metric])}%` }" /></div></td></tr></tbody>
        </table>
      </div>
      <div v-else class="cp-empty min-h-48 px-5 py-12">{{ t(search ? 'carpool.overview.noMatches' : 'carpool.overview.noData') }}</div>
      <div class="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800"><span>{{ t('carpool.overview.showing', { count: filteredRanking.length }) }}</span><span v-if="ranking.length === 200" class="text-amber-700 dark:text-amber-400">{{ t('carpool.overview.truncated') }}</span></div>
    </article>

    <div class="grid gap-4 md:grid-cols-2"><div class="cp-panel p-5"><h3 class="text-sm font-semibold text-blue-700 dark:text-blue-300">{{ t('carpool.overview.billing') }}</h3><p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ t('carpool.overview.billingHint') }}</p></div><div class="cp-panel p-5"><h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ t('carpool.overview.scope') }}</h3><p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ t('carpool.overview.scopeHint') }}</p></div></div>
    <footer class="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{{ t('carpool.overview.timezone') }}: {{ timezone }}</span><span v-if="updatedAt">{{ t('carpool.overview.updated') }}: {{ updatedAt }}</span></footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Line, Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler, type ChartOptions } from 'chart.js'
import { saveAs } from 'file-saver'
import { readCarpoolFilters, carpoolFilterQuery } from '@/utils/carpoolFilters'
import { apiClient } from '@/api/client'
import type { DashboardSnapshotV2Response, UserBreakdownResponse } from '@/api/admin/dashboard'
import type { UserBreakdownItem } from '@/types'
import { carpoolDateRange, validCarpoolRange, summarizeCarpoolTrend, carpoolRankingCsv, carpoolTrendCsv, type CarpoolMetric, type CarpoolPeriod } from '@/utils/carpoolOverview'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)
const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const initialFilters = readCarpoolFilters(route.query)
let restoringQuery = false
const queryError = ref(false)
const periods: CarpoolPeriod[] = ['7d', '30d', 'month', 'custom']
const metrics: CarpoolMetric[] = ['actual_cost', 'total_tokens', 'requests']
const period = ref<CarpoolPeriod>(initialFilters.period)
const metric = ref<CarpoolMetric>(initialFilters.metric)
const initialRange = initialFilters
const startDate = ref(initialRange.start)
const endDate = ref(initialRange.end)
const draftStart = ref(initialRange.start)
const draftEnd = ref(initialRange.end)
const rangeError = ref(false)
const loading = ref(true)
const dataError = ref(false)
const rankingError = ref(false)
const snapshot = ref<DashboardSnapshotV2Response | null>(null)
const ranking = ref<UserBreakdownItem[]>([])
const search = ref('')
const updatedAt = ref('')
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const dark = ref(document.documentElement.classList.contains('dark'))
let observer: MutationObserver | undefined
let controller: AbortController | undefined
let sequence = 0
const palette = ['#3b6cff', '#9474ff', '#31cba2', '#f6b94a', '#70b8ff', '#94a3b8']
const totals = computed(() => summarizeCarpoolTrend(snapshot.value?.trend || []))
const money = (value: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
const compact = (value: number) => new Intl.NumberFormat(locale.value, { notation: 'compact', maximumFractionDigits: 2 }).format(value)
const summaryCards = computed(() => [
  { key: 'actual_cost', hint: 'chargedHint', value: snapshot.value ? money(totals.value.actual_cost) : '—', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { key: 'requests', hint: 'requestsHint', value: snapshot.value ? compact(totals.value.requests) : '—', color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40', icon: 'm3 17 6-6 4 4 8-10M15 5h6v6' },
  { key: 'total_tokens', hint: 'tokensHint', value: snapshot.value ? compact(totals.value.total_tokens) : '—', color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40', icon: 'm12 3-9 5 9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5' },
  { key: 'activeMembers', hint: 'membersHint', value: rankingError.value ? '—' : `${ranking.value.length === 200 ? '≥ ' : ''}${ranking.value.length}`, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' }
])
const filteredRanking = computed(() => ranking.value.map((row, index) => ({ ...row, rank: index + 1 })).filter(row => `${row.email} ${row.user_id}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const modelItems = computed(() => {
  const models = [...(snapshot.value?.models || [])].filter(m => m.actual_cost > 0).sort((a, b) => b.actual_cost - a.actual_cost)
  const items = models.slice(0, 5).map(m => ({ model: m.model, actual_cost: m.actual_cost }))
  if (models.length > 5) items.push({ model: t('carpool.overview.others'), actual_cost: models.slice(5).reduce((sum, model) => sum + model.actual_cost, 0) })
  return items
})
const trendChart = computed(() => ({ labels: (snapshot.value?.trend || []).map(point => point.date), datasets: [{ label: t(`carpool.overview.${metric.value}`), data: (snapshot.value?.trend || []).map(point => point[metric.value]), borderColor: '#3b6cff', backgroundColor: 'rgba(59,108,255,0.09)', fill: true, tension: 0.3, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2 }] }))
const lineOptions = computed<ChartOptions<'line'>>(() => ({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${metric.value === 'actual_cost' ? money(context.parsed.y || 0) : compact(context.parsed.y || 0)}` } } }, scales: { x: { grid: { display: false }, ticks: { color: dark.value ? '#94a3b8' : '#64748b', maxTicksLimit: 8, maxRotation: 0 } }, y: { beginAtZero: true, grid: { color: dark.value ? '#1e293b' : '#edf1f7' }, ticks: { color: dark.value ? '#94a3b8' : '#64748b', callback: value => metric.value === 'actual_cost' ? money(Number(value)) : compact(Number(value)) } } } }))
const modelChart = computed(() => ({ labels: modelItems.value.map(m => m.model), datasets: [{ data: modelItems.value.map(m => m.actual_cost), backgroundColor: palette, borderWidth: 3, borderColor: dark.value ? '#0f172a' : '#ffffff', hoverOffset: 4 }] }))
const doughnutOptions: ChartOptions<'doughnut'> = { responsive: true, maintainAspectRatio: false, cutout: '74%', animation: false, plugins: { legend: { display: false } } }
const shareValue = (value: number) => totals.value[metric.value] > 0 ? Math.min(100, Math.max(0, value / totals.value[metric.value] * 100)) : 0
const share = (value: number) => !snapshot.value || totals.value[metric.value] <= 0 ? '—' : `${shareValue(value).toFixed(1)}%`

async function loadData() {
  if (!validCarpoolRange(startDate.value, endDate.value)) return
  const current = ++sequence
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  dataError.value = false
  rankingError.value = false
  const params = { start_date: startDate.value, end_date: endDate.value, timezone }
  const results = await Promise.allSettled([
    apiClient.get<DashboardSnapshotV2Response>('/admin/dashboard/snapshot-v2', { params: { ...params, granularity: 'day', include_stats: false, include_trend: true, include_model_stats: true, include_group_stats: false, include_users_trend: false }, signal: controller.signal }),
    apiClient.get<UserBreakdownResponse>('/admin/dashboard/user-breakdown', { params: { ...params, sort_by: metric.value, limit: 200 }, signal: controller.signal })
  ])
  if (current !== sequence) return
  const [summary, members] = results
  snapshot.value = summary.status === 'fulfilled' ? summary.value.data : null
  dataError.value = summary.status === 'rejected'
  ranking.value = members.status === 'fulfilled' ? members.value.data.users || [] : []
  rankingError.value = members.status === 'rejected'
  updatedAt.value = !dataError.value || !rankingError.value ? new Date().toLocaleTimeString(locale.value) : ''
  loading.value = false
}
function applyCustomRange() {
  rangeError.value = !validCarpoolRange(draftStart.value, draftEnd.value)
  if (rangeError.value) return
  startDate.value = draftStart.value
  endDate.value = draftEnd.value
  persistFilters()
  void loadData()
}
function exportTrend() {
  if (loading.value || dataError.value || !snapshot.value?.trend?.length) return
  const keys = ['date', 'actual_cost', 'total_tokens', 'requests']
  saveAs(new Blob([carpoolTrendCsv(snapshot.value.trend, keys.map(key => t(`carpool.overview.${key}`)))], { type: 'text/csv;charset=utf-8' }), `carpool-daily-${startDate.value}-${endDate.value}.csv`)
}
function exportRanking() {
  if (!ranking.value.length || loading.value || rankingError.value) return
  const keys = ['rank', 'userId', 'member', 'actual_cost', 'total_tokens', 'requests']
  saveAs(new Blob([carpoolRankingCsv(ranking.value, keys.map(key => t(`carpool.overview.${key}`)))], { type: 'text/csv;charset=utf-8' }), `carpool-top200-${startDate.value}-${endDate.value}.csv`)
}
function openUsage(userId: number) { void router.push({ path: '/admin/usage', query: { user_id: String(userId), start_date: startDate.value, end_date: endDate.value } }) }
function persistFilters() {
  queryError.value = false
  const query = carpoolFilterQuery(route.query, { period: period.value, metric: metric.value, start: startDate.value, end: endDate.value })
  void Promise.resolve(router.replace({ query })).catch(() => { queryError.value = true })
}
watch(period, value => {
  if (restoringQuery) return
  rangeError.value = false
  if (value !== 'custom') {
    const range = carpoolDateRange(value)
    startDate.value = draftStart.value = range.start
    endDate.value = draftEnd.value = range.end
  }
  persistFilters()
  if (value !== 'custom') void loadData()
}, { flush: 'sync' })
watch(metric, () => {
  if (restoringQuery) return
  persistFilters()
  void loadData()
}, { flush: 'sync' })
watch(() => route.query, query => {
  const next = readCarpoolFilters(query)
  if (next.period === period.value && next.metric === metric.value && next.start === startDate.value && next.end === endDate.value) return
  restoringQuery = true
  period.value = next.period
  metric.value = next.metric
  startDate.value = draftStart.value = next.start
  endDate.value = draftEnd.value = next.end
  rangeError.value = false
  restoringQuery = false
  void loadData()
})
onMounted(() => {
  observer = new MutationObserver(() => { dark.value = document.documentElement.classList.contains('dark') })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  void loadData()
})
onBeforeUnmount(() => { sequence++; controller?.abort(); observer?.disconnect() })
</script>
