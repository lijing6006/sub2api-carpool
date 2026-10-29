<template>
  <section class="space-y-4" aria-labelledby="member-attention-title">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="member-attention-title" class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('carpoolAttention.title') }}</h2>
        <p class="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">{{ t('carpoolAttention.description') }}</p>
      </div>
      <span class="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">{{ t('carpoolAttention.readOnly') }}</span>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <article class="attention-card" data-test="balance-attention" :aria-busy="membersLoading">
        <header class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300" aria-hidden="true">$</span>
            <div>
              <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('carpoolAttention.lowBalanceTitle') }}</h3>
              <p class="mt-0.5 text-xs text-slate-500">{{ t('carpoolAttention.inThisBatch') }}</p>
            </div>
          </div>
          <span class="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100" data-test="balance-count">{{ membersLoading ? '…' : membersError || !thresholdValid ? '—' : lowBalanceMembers.length }}</span>
        </header>

        <div class="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label for="attention-balance-threshold" class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ t('carpoolAttention.threshold') }}</label>
            <input id="attention-balance-threshold" v-model.number="threshold" type="number" min="0" step="any" class="input max-w-28 text-right tabular-nums" :aria-invalid="!thresholdValid" :aria-describedby="thresholdValid ? 'attention-threshold-note' : 'attention-threshold-note attention-threshold-error'" />
          </div>
          <p id="attention-threshold-note" class="mt-2 text-xs leading-5 text-slate-500">{{ t('carpoolAttention.thresholdNote') }}</p>
          <p v-if="!thresholdValid" id="attention-threshold-error" class="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">{{ t('carpoolAttention.invalidThreshold') }}</p>
        </div>

        <div v-if="membersLoading" class="mt-4 space-y-2" role="status"><p class="text-xs text-slate-500">{{ t('carpoolAttention.loadingMembers') }}</p><div class="h-16 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-800" /></div>
        <div v-else-if="membersError" class="attention-error" role="alert"><p>{{ t('carpoolAttention.membersError') }}</p><p class="mt-1 text-xs">{{ t('carpoolAttention.unknownNotZero') }}</p></div>
        <template v-else-if="thresholdValid">
          <ul v-if="lowBalanceMembers.length" class="attention-list">
            <li v-for="member in lowBalanceMembers" :key="member.id" class="flex items-center justify-between gap-3 py-3" :data-test="`low-balance-${member.id}`">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ member.username || member.email || t('carpoolAttention.memberFallback', { id: member.id }) }}</p>
                <p class="mt-0.5 truncate text-xs text-slate-500">{{ member.email }}</p>
              </div>
              <span class="shrink-0 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-300">{{ money(member.balance) }}</span>
            </li>
          </ul>
          <div v-else class="attention-empty" data-test="balance-empty">{{ t(members.length ? 'carpoolAttention.noLowBalance' : 'carpoolAttention.noMembers') }}</div>
          <p v-if="invalidMemberCount" class="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">{{ t('carpoolAttention.invalidMembers', { count: invalidMemberCount }) }}</p>
        </template>

        <footer class="attention-footer">
          <p v-if="!membersLoading && !membersError" class="text-xs leading-5 text-slate-500">{{ t('carpoolAttention.memberScope', { inspected: members.length, limit: sourceLimit }) }}</p>
          <p v-else class="text-xs leading-5 text-slate-500">{{ t('carpoolAttention.memberScopeLimit', { limit: sourceLimit }) }}</p>
          <p v-if="membersCheckedAt && !membersLoading && !membersError" class="mt-1 text-[11px] text-slate-400">{{ t('carpoolAttention.checkedAt', { time: formatTime(membersCheckedAt) }) }}</p>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <RouterLink :to="{ path: '/admin/carpool', query: { tab: 'members' } }" class="attention-link">{{ t('carpoolAttention.manageMembers') }} <span aria-hidden="true">↗</span></RouterLink>
            <button type="button" class="attention-button" data-test="refresh-members" @click="loadMembers">{{ t(membersError ? 'carpoolAttention.retry' : 'carpoolAttention.refresh') }}</button>
          </div>
        </footer>
      </article>

      <article class="attention-card" data-test="subscription-attention" :aria-busy="subscriptionsLoading">
        <header class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" aria-hidden="true"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-9 4h5" /></svg></span>
            <div>
              <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('carpoolAttention.expiringTitle') }}</h3>
              <p class="mt-0.5 text-xs text-slate-500">{{ t('carpoolAttention.nextSevenDays') }}</p>
            </div>
          </div>
          <span class="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100" data-test="subscription-count">{{ subscriptionsLoading ? '…' : subscriptionsError ? '—' : expiringSubscriptions.length }}</span>
        </header>
        <p class="mt-4 rounded-xl bg-blue-50/70 p-3 text-xs leading-5 text-slate-600 dark:bg-blue-950/40 dark:text-slate-300">{{ t('carpoolAttention.expiryNote') }}</p>

        <div v-if="subscriptionsLoading" class="mt-4 space-y-2" role="status"><p class="text-xs text-slate-500">{{ t('carpoolAttention.loadingSubscriptions') }}</p><div class="h-16 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-800" /></div>
        <div v-else-if="subscriptionsError" class="attention-error" role="alert"><p>{{ t('carpoolAttention.subscriptionsError') }}</p><p class="mt-1 text-xs">{{ t('carpoolAttention.unknownNotZero') }}</p></div>
        <template v-else>
          <ul v-if="expiringSubscriptions.length" class="attention-list">
            <li v-for="subscription in expiringSubscriptions" :key="subscription.id" class="flex items-center justify-between gap-3 py-3" :data-test="`expiring-subscription-${subscription.id}`">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ subscription.user?.username || subscription.user?.email || t('carpoolAttention.memberFallback', { id: subscription.user_id }) }}</p>
                <p class="mt-0.5 truncate text-xs text-slate-500">{{ subscription.group?.name || t('carpoolAttention.groupFallback', { id: subscription.group_id }) }} · {{ formatDate(subscription.expires_at!) }}</p>
              </div>
              <span class="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{{ expiryLabel(subscription.expires_at!) }}</span>
            </li>
          </ul>
          <div v-else class="attention-empty" data-test="subscriptions-empty">{{ t(subscriptions.length ? 'carpoolAttention.noExpiring' : 'carpoolAttention.noSubscriptions') }}</div>
          <p v-if="invalidSubscriptionCount" class="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">{{ t('carpoolAttention.invalidSubscriptions', { count: invalidSubscriptionCount }) }}</p>
        </template>

        <footer class="attention-footer">
          <p v-if="!subscriptionsLoading && !subscriptionsError" class="text-xs leading-5 text-slate-500">{{ t('carpoolAttention.subscriptionScope', { inspected: subscriptions.length, limit: sourceLimit }) }}</p>
          <p v-else class="text-xs leading-5 text-slate-500">{{ t('carpoolAttention.subscriptionScopeLimit', { limit: sourceLimit }) }}</p>
          <p v-if="subscriptionsCheckedAt && !subscriptionsLoading && !subscriptionsError" class="mt-1 text-[11px] text-slate-400">{{ t('carpoolAttention.checkedAt', { time: formatTime(subscriptionsCheckedAt) }) }}</p>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <RouterLink to="/admin/subscriptions" class="attention-link">{{ t('carpoolAttention.manageSubscriptions') }} <span aria-hidden="true">↗</span></RouterLink>
            <button type="button" class="attention-button" data-test="refresh-subscriptions" @click="loadSubscriptions">{{ t(subscriptionsError ? 'carpoolAttention.retry' : 'carpoolAttention.refresh') }}</button>
          </div>
        </footer>
      </article>
    </div>
    <p class="text-xs leading-5 text-slate-400">{{ t('carpoolAttention.scopeDisclaimer', { limit: sourceLimit, timezone }) }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminUser, UserSubscription } from '@/types'

const { t, locale } = useI18n()
const sourceLimit = 100
const dayMs = 24 * 60 * 60 * 1000
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const threshold = ref<number | string>(5)
const thresholdValid = computed(() => typeof threshold.value === 'number' && Number.isFinite(threshold.value) && threshold.value >= 0)
const members = ref<AdminUser[]>([])
const subscriptions = ref<UserSubscription[]>([])
const membersLoading = ref(true)
const subscriptionsLoading = ref(true)
const membersError = ref(false)
const subscriptionsError = ref(false)
const membersCheckedAt = ref<number | null>(null)
const subscriptionsCheckedAt = ref<number | null>(null)
let membersController: AbortController | null = null
let subscriptionsController: AbortController | null = null
let membersRequest = 0
let subscriptionsRequest = 0
let disposed = false

/** Backend timestamps are RFC 3339. Reject normalization of impossible calendar dates. */
function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!parts) return null
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const maxDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > maxDay || hour > 23 || minute > 59 || second > 59) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function subscriptionWindow(subscription: UserSubscription): { start: number; end: number } | null {
  const start = parseTimestamp(subscription.starts_at)
  const end = subscription.expires_at === null ? Infinity : parseTimestamp(subscription.expires_at)
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

function memberEligibility(member: AdminUser): 'eligible' | 'excluded' | 'unknown' {
  if (member.role !== 'user' || member.status !== 'active') return 'excluded'
  if (!Number.isFinite(member.balance)) return 'unknown'
  const now = membersCheckedAt.value ?? Date.now()
  let unknown = false
  for (const subscription of member.subscriptions || []) {
    if (subscription.status !== 'active') continue
    const window = subscriptionWindow(subscription)
    if (!window) unknown = true
    else if (window.start <= now && window.end > now) return 'excluded'
  }
  return unknown ? 'unknown' : 'eligible'
}

const lowBalanceMembers = computed(() => thresholdValid.value
  ? members.value.filter(member => memberEligibility(member) === 'eligible' && member.balance <= Number(threshold.value)).sort((a, b) => a.balance - b.balance)
  : [])
const invalidMemberCount = computed(() => members.value.filter(member => memberEligibility(member) === 'unknown').length)
const invalidSubscriptionCount = computed(() => subscriptions.value.filter(subscription => subscription.status === 'active' && !subscriptionWindow(subscription)).length)
const expiringSubscriptions = computed(() => {
  const now = subscriptionsCheckedAt.value ?? Date.now()
  return subscriptions.value.filter(subscription => {
    if (subscription.status !== 'active') return false
    const window = subscriptionWindow(subscription)
    return window !== null && window.start <= now && window.end > now && window.end <= now + 7 * dayMs
  }).sort((a, b) => parseTimestamp(a.expires_at)! - parseTimestamp(b.expires_at)!)
})

const money = (value: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)
const formatTime = (value: number) => new Date(value).toLocaleString(locale.value)
function expiryLabel(expiresAt: string): string {
  const remaining = parseTimestamp(expiresAt)! - (subscriptionsCheckedAt.value ?? Date.now())
  return remaining <= dayMs ? t('carpoolAttention.withinOneDay') : t('carpoolAttention.daysRemaining', { count: Math.ceil(remaining / dayMs) })
}

async function loadMembers(): Promise<void> {
  const request = ++membersRequest
  membersController?.abort()
  membersController = new AbortController()
  membersLoading.value = true
  membersError.value = false
  try {
    const result = await adminAPI.users.list(1, sourceLimit, { role: 'user', status: 'active', include_subscriptions: true, sort_by: 'balance', sort_order: 'asc' }, { signal: membersController.signal })
    if (disposed || request !== membersRequest) return
    members.value = (result.items || []).slice(0, sourceLimit)
    membersCheckedAt.value = Date.now()
  } catch {
    if (disposed || request !== membersRequest) return
    members.value = []
    membersCheckedAt.value = null
    membersError.value = true
  } finally {
    if (!disposed && request === membersRequest) membersLoading.value = false
  }
}

async function loadSubscriptions(): Promise<void> {
  const request = ++subscriptionsRequest
  subscriptionsController?.abort()
  subscriptionsController = new AbortController()
  subscriptionsLoading.value = true
  subscriptionsError.value = false
  try {
    const result = await adminAPI.subscriptions.list(1, sourceLimit, { status: 'active', sort_by: 'expires_at', sort_order: 'asc' }, { signal: subscriptionsController.signal })
    if (disposed || request !== subscriptionsRequest) return
    subscriptions.value = (result.items || []).slice(0, sourceLimit)
    subscriptionsCheckedAt.value = Date.now()
  } catch {
    if (disposed || request !== subscriptionsRequest) return
    subscriptions.value = []
    subscriptionsCheckedAt.value = null
    subscriptionsError.value = true
  } finally {
    if (!disposed && request === subscriptionsRequest) subscriptionsLoading.value = false
  }
}

onMounted(() => { void loadMembers(); void loadSubscriptions() })
onUnmounted(() => {
  disposed = true
  membersRequest++
  subscriptionsRequest++
  membersController?.abort()
  subscriptionsController?.abort()
})
</script>

<style scoped>
.attention-card { @apply flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900; }
.attention-list { @apply mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800; }
.attention-empty { @apply flex min-h-28 items-center justify-center px-3 py-6 text-center text-sm leading-6 text-slate-500 dark:text-slate-400; }
.attention-error { @apply mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200; }
.attention-footer { @apply mt-auto border-t border-slate-100 pt-4 dark:border-slate-800; }
.attention-button { @apply inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800; }
.attention-link { @apply inline-flex min-h-10 items-center gap-2 py-2 text-xs font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400; }
</style>
