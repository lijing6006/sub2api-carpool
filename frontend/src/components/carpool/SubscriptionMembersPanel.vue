<template>
  <section class="space-y-5" aria-labelledby="carpool-members-title">
    <div class="grid gap-4 lg:grid-cols-2">
      <article class="member-card p-5">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <p class="member-eyebrow">{{ t('carpoolMembers.subscriptionEyebrow') }}</p>
            <h3 class="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{{ t('carpoolMembers.subscriptionTitle') }}</h3>
          </div>
          <span class="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">01</span>
        </div>
        <p class="text-sm leading-6 text-slate-500 dark:text-slate-400">{{ t('carpoolMembers.subscriptionDescription') }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <RouterLink to="/admin/groups" class="member-button">{{ t('carpoolMembers.configureQuota') }} <span aria-hidden="true">↗</span></RouterLink>
          <RouterLink to="/admin/subscriptions" class="member-link">{{ t('carpoolMembers.subscriptionRecords') }}</RouterLink>
          <RouterLink v-if="adminSettings.paymentEnabled" to="/admin/orders/plans" class="member-link">{{ t('carpoolMembers.salePlans') }}</RouterLink>
        </div>
      </article>
      <article class="member-card p-5">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <p class="member-eyebrow">{{ t('carpoolMembers.balanceEyebrow') }}</p>
            <h3 class="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{{ t('carpoolMembers.balanceTitle') }}</h3>
          </div>
          <span class="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">02</span>
        </div>
        <p class="text-sm leading-6 text-slate-500 dark:text-slate-400">{{ t('carpoolMembers.balanceDescription') }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <RouterLink to="/admin/users" class="member-button">{{ t('carpoolMembers.manageMembers') }} <span aria-hidden="true">↗</span></RouterLink>
          <RouterLink to="/admin/groups" class="member-link">{{ t('carpoolMembers.configureUsageGroups') }}</RouterLink>
        </div>
      </article>
    </div>

    <div class="member-card overflow-hidden">
      <div class="border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="carpool-members-title" class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('carpoolMembers.title') }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ t('carpoolMembers.billingNote') }}</p>
          </div>
          <button type="button" class="member-button" :disabled="loading" @click="loadMembers()">{{ t('carpoolMembers.refresh') }}</button>
        </div>
        <form class="mt-5 flex flex-wrap items-end gap-3" data-test="member-search" @submit.prevent="applySearch">
          <div class="min-w-48 flex-1">
            <label for="carpool-member-search" class="sr-only">{{ t('carpoolMembers.searchLabel') }}</label>
            <input id="carpool-member-search" v-model="searchInput" type="search" maxlength="200" class="input" :placeholder="t('carpoolMembers.searchLabel')" />
          </div>
          <div>
            <label for="carpool-member-status" class="sr-only">{{ t('carpoolMembers.status') }}</label>
            <select id="carpool-member-status" v-model="statusFilter" class="input min-w-32" @change="applySearch">
              <option value="">{{ t('carpoolMembers.allStatuses') }}</option>
              <option value="active">{{ t('carpoolMembers.active') }}</option>
              <option value="disabled">{{ t('carpoolMembers.disabled') }}</option>
            </select>
          </div>
          <button type="submit" class="member-button-primary">{{ t('carpoolMembers.search') }}</button>
        </form>
      </div>

      <div v-if="successMessage" class="mx-5 mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" role="status">{{ successMessage }}</div>
      <div v-if="membersError" class="m-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950" role="alert">
        <p class="text-sm text-red-800 dark:text-red-200">{{ membersError }}</p>
        <button type="button" class="mt-2 text-sm font-semibold text-red-700 underline dark:text-red-300" @click="loadMembers()">{{ t('carpoolMembers.retry') }}</button>
      </div>
      <div v-else-if="loading && members.length === 0" class="px-6 py-16 text-center text-sm text-slate-500" role="status">{{ t('carpoolMembers.loading') }}</div>
      <div v-else-if="members.length === 0" class="px-6 py-16 text-center">
        <p class="font-semibold text-slate-700 dark:text-slate-200">{{ t('carpoolMembers.emptyTitle') }}</p>
        <p class="mt-2 text-sm text-slate-500">{{ t('carpoolMembers.emptyDescription') }}</p>
        <RouterLink to="/admin/users" class="member-button mt-5">{{ t('carpoolMembers.manageMembers') }}</RouterLink>
      </div>
      <div v-else class="overflow-x-auto" :aria-busy="loading">
        <p v-if="loading" class="px-6 pt-3 text-xs text-blue-600 dark:text-blue-300" role="status">{{ t('carpoolMembers.updating') }}</p>
        <table class="w-full min-w-[790px] text-left text-sm">
          <caption class="sr-only">{{ t('carpoolMembers.title') }}</caption>
          <thead class="bg-slate-50/80 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('carpoolMembers.member') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('carpoolMembers.currentBalance') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('carpoolMembers.currentSubscriptions') }}</th>
              <th scope="col" class="px-4 py-3 font-medium">{{ t('carpoolMembers.status') }}</th>
              <th scope="col" class="px-6 py-3 text-right font-medium">{{ t('carpoolMembers.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="member in members" :key="member.id" class="hover:bg-blue-50/30 dark:hover:bg-slate-800/40">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300" aria-hidden="true">{{ memberInitial(member) }}</span>
                  <div class="min-w-0">
                    <p class="max-w-56 truncate font-semibold text-slate-800 dark:text-slate-100">{{ member.username || member.email }}</p>
                    <p class="mt-0.5 max-w-56 truncate text-xs text-slate-500">{{ member.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-4">
                <p class="font-semibold tabular-nums" :class="member.balance <= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'">{{ money(member.balance) }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ t('carpoolMembers.payAsYouGo') }}</p>
              </td>
              <td class="px-4 py-4">
                <div v-if="activeSubscriptions(member).length" class="space-y-1.5">
                  <div v-for="subscription in activeSubscriptions(member)" :key="subscription.id">
                    <p class="font-medium text-slate-700 dark:text-slate-200">{{ subscription.group?.name || t('carpoolMembers.groupFallback', { id: subscription.group_id }) }}</p>
                    <p class="text-xs text-slate-500">{{ subscription.expires_at ? t('carpoolMembers.expires', { date: formatDate(subscription.expires_at) }) : t('carpoolMembers.noExpiry') }}</p>
                  </div>
                </div>
                <span v-else class="text-slate-400">{{ t('carpoolMembers.noSubscription') }}</span>
              </td>
              <td class="px-4 py-4">
                <span class="rounded-full px-2.5 py-1 text-xs font-medium" :class="member.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'">{{ member.status === 'active' ? t('carpoolMembers.active') : t('carpoolMembers.disabled') }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="flex justify-end gap-2">
                  <button type="button" class="member-button" :disabled="loading || member.status !== 'active'" :data-test="`assign-${member.id}`" @click="openAction(member, 'assign')">{{ t('carpoolMembers.assign') }}</button>
                  <button type="button" class="member-button" :disabled="loading" :data-test="`balance-${member.id}`" @click="openAction(member, 'balance')">{{ t('carpoolMembers.addBalance') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <p class="text-xs text-slate-500">{{ t('carpoolMembers.pagination', { page, pages, total }) }}</p>
        <div class="flex gap-2">
          <button type="button" class="member-button" :disabled="loading || page <= 1" data-test="previous-page" @click="changePage(page - 1)">{{ t('carpoolMembers.previous') }}</button>
          <button type="button" class="member-button" :disabled="loading || page >= pages" data-test="next-page" @click="changePage(page + 1)">{{ t('carpoolMembers.next') }}</button>
        </div>
      </div>
    </div>

    <BaseDialog :show="action !== null" :title="action === 'assign' ? t('carpoolMembers.assignTitle') : t('carpoolMembers.balanceDialogTitle')" :show-close-button="!submitting" :close-on-escape="!submitting" @close="closeAction">
      <form v-if="selectedMember" id="carpool-member-action" class="space-y-5" data-test="member-action-form" @submit.prevent="submitAction">
        <div class="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
          <p class="font-semibold text-slate-900 dark:text-slate-100">{{ selectedMember.username || selectedMember.email }}</p>
          <p class="break-all text-sm text-slate-500">{{ selectedMember.email }}</p>
        </div>
        <template v-if="action === 'assign'">
          <div v-if="groupsError" class="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
            {{ groupsError }}
            <button type="button" class="ml-2 font-semibold underline" @click="loadGroups">{{ t('carpoolMembers.retry') }}</button>
          </div>
          <p v-else-if="groupsLoading" class="text-sm text-slate-500" role="status">{{ t('carpoolMembers.loadingGroups') }}</p>
          <div v-else-if="subscriptionGroups.length === 0" class="rounded-xl bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <p>{{ t('carpoolMembers.noGroups') }}</p>
            <RouterLink to="/admin/groups" class="mt-2 inline-block font-semibold underline">{{ t('carpoolMembers.configureQuota') }}</RouterLink>
          </div>
          <div v-else>
            <label for="carpool-subscription-group" class="input-label">{{ t('carpoolMembers.subscriptionGroup') }}</label>
            <select id="carpool-subscription-group" v-model.number="assignment.groupId" class="input" :disabled="submitting" required>
              <option :value="0" disabled>{{ t('carpoolMembers.selectGroup') }}</option>
              <option v-for="group in subscriptionGroups" :key="group.id" :value="group.id">{{ group.name }} · {{ group.platform }}</option>
            </select>
            <div v-if="selectedGroup" class="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/50">
              <div v-for="window in quotaWindows" :key="window.key">
                <p class="text-xs text-slate-500">{{ t(window.label) }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{{ quotaLimit(selectedGroup[window.key]) }}</p>
              </div>
            </div>
          </div>
          <div>
            <label for="carpool-subscription-days" class="input-label">{{ t('carpoolMembers.validityDays') }}</label>
            <input id="carpool-subscription-days" v-model.number="assignment.days" type="number" min="1" max="36500" step="1" required class="input" :disabled="submitting" />
            <p class="mt-2 text-xs leading-5 text-slate-500">{{ t('carpoolMembers.assignmentNote') }}</p>
          </div>
        </template>
        <template v-else>
          <div class="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <p>{{ t('carpoolMembers.currentBalance') }}: <strong>{{ money(selectedMember.balance) }}</strong></p>
            <p class="mt-1 text-xs leading-5">{{ t('carpoolMembers.balanceAdjustmentNote') }}</p>
          </div>
          <div>
            <label for="carpool-balance-amount" class="input-label">{{ t('carpoolMembers.amount') }}</label>
            <input id="carpool-balance-amount" v-model.number="balanceForm.amount" type="number" min="0.00000001" step="any" required class="input" :disabled="submitting || balanceNeedsReview || balanceRetryLocked" />
          </div>
          <div>
            <label for="carpool-balance-note" class="input-label">{{ t('carpoolMembers.auditNote') }}</label>
            <textarea id="carpool-balance-note" v-model="balanceForm.note" rows="2" maxlength="500" required class="input" :disabled="submitting || balanceNeedsReview || balanceRetryLocked"></textarea>
          </div>
          <p v-if="balanceNeedsReview" class="text-sm text-amber-700 dark:text-amber-300" role="status">{{ t('carpoolMembers.reviewBeforeRetry') }}</p>
          <p v-else-if="balanceRetryLocked" class="text-sm text-blue-700 dark:text-blue-300" role="status">{{ t('carpoolMembers.retrySameAdjustment') }}</p>
        </template>
        <p v-if="actionError" class="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{{ actionError }}</p>
      </form>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="member-button" :disabled="submitting" @click="closeAction">{{ t('carpoolMembers.cancel') }}</button>
          <button v-if="balanceNeedsReview" type="button" class="member-button-primary" :disabled="submitting" data-test="review-balance" @click="reviewBalance">{{ submitting ? t('carpoolMembers.loading') : t('carpoolMembers.reviewBalance') }}</button>
          <button v-else type="submit" form="carpool-member-action" class="member-button-primary" :disabled="submitting || (action === 'assign' && (groupsLoading || !!groupsError || !subscriptionGroups.length))" data-test="confirm-action">{{ submitting ? t('carpoolMembers.saving') : t('carpoolMembers.confirm') }}</button>
        </div>
      </template>
    </BaseDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import { extractApiErrorMessage } from '@/utils/apiError'
import type { AdminGroup, AdminUser, UserSubscription } from '@/types'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { completeMemberBalanceOperation, prepareMemberBalanceOperation, type MemberBalanceOperation } from './memberBalanceOperation'

const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const adminSettings = useAdminSettingsStore()
const members = ref<AdminUser[]>([])
const groups = ref<AdminGroup[]>([])
const loading = ref(false)
const groupsLoading = ref(false)
const membersError = ref('')
const groupsError = ref('')
const successMessage = ref('')
const searchInput = ref('')
const search = ref('')
const statusFilter = ref<'' | 'active' | 'disabled'>('')
const page = ref(1)
const total = ref(0)
const pages = ref(1)
const pageSize = 12
let memberController: AbortController | null = null
let memberRequest = 0
let groupRequest = 0
let disposed = false

const subscriptionGroups = computed(() => groups.value.filter(group => group.status === 'active' && group.subscription_type === 'subscription'))
const selectedMember = ref<AdminUser | null>(null)
const action = ref<'assign' | 'balance' | null>(null)
const submitting = ref(false)
const actionError = ref('')
const balanceNeedsReview = ref(false)
const balanceRetryLocked = ref(false)
const uncertainBalanceForms = new Map<number, { amount: number; note: string; operation: MemberBalanceOperation }>()
let balanceOperation: MemberBalanceOperation | null = null
let reviewedBalanceKey = ''
const assignment = reactive({ groupId: 0, days: 30 })
const balanceForm = reactive({ amount: 0, note: '' })
const selectedGroup = computed(() => subscriptionGroups.value.find(group => group.id === assignment.groupId))
const quotaWindows = [
  { key: 'daily_limit_usd', label: 'carpoolMembers.dailyQuota' },
  { key: 'weekly_limit_usd', label: 'carpoolMembers.weeklyQuota' },
  { key: 'monthly_limit_usd', label: 'carpoolMembers.monthlyQuota' }
] as const

function money(value: number): string {
  return new Intl.NumberFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value)
}

function quotaLimit(value: number | null): string {
  return value !== null && value > 0 ? money(value) : t('carpoolMembers.unlimited')
}

function memberInitial(member: AdminUser): string {
  return (member.username || member.email || '?').slice(0, 1).toUpperCase()
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale.value === 'zh' ? 'zh-CN' : 'en-US')
}

function activeSubscriptions(member: AdminUser): UserSubscription[] {
  const now = Date.now()
  return (member.subscriptions || []).filter(subscription => subscription.status === 'active'
    && (!subscription.expires_at || new Date(subscription.expires_at).getTime() > now)
    && (!subscription.starts_at || new Date(subscription.starts_at).getTime() <= now))
}

async function loadMembers(): Promise<void> {
  const request = ++memberRequest
  memberController?.abort()
  memberController = new AbortController()
  loading.value = true
  membersError.value = ''
  try {
    const response = await adminAPI.users.list(page.value, pageSize, {
      role: 'user',
      search: search.value || undefined,
      status: statusFilter.value || undefined,
      include_subscriptions: true,
      sort_by: 'created_at',
      sort_order: 'desc'
    }, { signal: memberController.signal })
    if (disposed || request !== memberRequest) return
    members.value = response.items || []
    total.value = response.total
    pages.value = Math.max(1, response.pages)
    if (page.value > pages.value) {
      page.value = pages.value
      await loadMembers()
    }
  } catch (error) {
    if (disposed || request !== memberRequest) return
    membersError.value = extractApiErrorMessage(error, t('carpoolMembers.loadError'))
  } finally {
    if (!disposed && request === memberRequest) loading.value = false
  }
}

async function loadGroups(): Promise<void> {
  const request = ++groupRequest
  groupsLoading.value = true
  groupsError.value = ''
  try {
    const response = await adminAPI.groups.getAll()
    if (!disposed && request === groupRequest) groups.value = response
  } catch (error) {
    if (!disposed && request === groupRequest) groupsError.value = extractApiErrorMessage(error, t('carpoolMembers.groupsError'))
  } finally {
    if (!disposed && request === groupRequest) groupsLoading.value = false
  }
}

function applySearch(): void {
  search.value = searchInput.value.trim()
  page.value = 1
  void loadMembers()
}

function changePage(nextPage: number): void {
  if (loading.value || nextPage < 1 || nextPage > pages.value) return
  page.value = nextPage
  void loadMembers()
}

function openAction(member: AdminUser, mode: 'assign' | 'balance'): void {
  if (submitting.value || loading.value || (mode === 'assign' && member.status !== 'active')) return
  selectedMember.value = member
  action.value = mode
  assignment.groupId = 0
  assignment.days = 30
  const uncertain = mode === 'balance' ? uncertainBalanceForms.get(member.id) : undefined
  balanceForm.amount = uncertain?.amount ?? 0
  balanceForm.note = uncertain?.note ?? ''
  balanceOperation = uncertain?.operation ?? null
  balanceNeedsReview.value = !!uncertain
  balanceRetryLocked.value = !!uncertain
  reviewedBalanceKey = ''
  actionError.value = ''
  successMessage.value = ''
  if (mode === 'assign') void loadGroups()
}

function closeAction(): void {
  if (submitting.value) return
  action.value = null
  selectedMember.value = null
  actionError.value = ''
}

async function submitAction(): Promise<void> {
  if (submitting.value || !selectedMember.value || !action.value || balanceNeedsReview.value) return
  actionError.value = ''
  const mode = action.value
  const member = selectedMember.value
  if (mode === 'assign') {
    if (member.status !== 'active' || groupsLoading.value || groupsError.value || !selectedGroup.value) {
      actionError.value = t('carpoolMembers.selectGroup')
      return
    }
    if (!Number.isInteger(assignment.days) || assignment.days < 1 || assignment.days > 36500) {
      actionError.value = t('carpoolMembers.invalidDays')
      return
    }
  } else if (!Number.isFinite(balanceForm.amount) || balanceForm.amount <= 0 || !balanceForm.note.trim()) {
    actionError.value = t('carpoolMembers.invalidBalance')
    return
  }
  if (mode === 'balance') {
    balanceOperation ??= prepareMemberBalanceOperation(member.id, balanceForm.amount, balanceForm.note)
    if (balanceOperation.outcomeUncertain && reviewedBalanceKey !== balanceOperation.key) {
      balanceNeedsReview.value = true
      balanceRetryLocked.value = true
      uncertainBalanceForms.set(member.id, { ...balanceForm, operation: balanceOperation })
      return
    }
  }
  submitting.value = true
  try {
    if (mode === 'assign') {
      await adminAPI.subscriptions.assign({ user_id: member.id, group_id: assignment.groupId, validity_days: assignment.days })
    } else {
      await adminAPI.users.updateBalance(member.id, balanceForm.amount, 'add', balanceForm.note.trim(), balanceOperation!.key)
      completeMemberBalanceOperation(balanceOperation!)
      uncertainBalanceForms.delete(member.id)
    }
    if (disposed) return
    successMessage.value = mode === 'assign' ? t('carpoolMembers.assigned') : t('carpoolMembers.balanceAdded')
    action.value = null
    selectedMember.value = null
    emit('changed')
    void loadMembers()
  } catch (error) {
    if (disposed) return
    actionError.value = extractApiErrorMessage(error, t('carpoolMembers.saveError'))
    // A lost mutation response is not proof that no credit was applied. Do not offer blind retries.
    if (mode === 'balance' && balanceOperation) {
      balanceOperation.outcomeUncertain = true
      balanceNeedsReview.value = true
      balanceRetryLocked.value = true
      reviewedBalanceKey = ''
      uncertainBalanceForms.set(member.id, { ...balanceForm, operation: balanceOperation })
    }
  } finally {
    if (!disposed) submitting.value = false
  }
}

async function reviewBalance(): Promise<void> {
  if (submitting.value || !selectedMember.value || !balanceNeedsReview.value) return
  submitting.value = true
  actionError.value = ''
  try {
    const member = await adminAPI.users.getById(selectedMember.value.id)
    if (disposed) return
    selectedMember.value = member
    balanceNeedsReview.value = false
    reviewedBalanceKey = balanceOperation?.key ?? ''
    void loadMembers()
  } catch (error) {
    if (!disposed) actionError.value = extractApiErrorMessage(error, t('carpoolMembers.loadError'))
  } finally {
    if (!disposed) submitting.value = false
  }
}

onMounted(() => { void loadMembers() })
onUnmounted(() => {
  disposed = true
  memberRequest++
  groupRequest++
  memberController?.abort()
})
</script>

<style scoped>
.member-card { @apply rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900; }
.member-eyebrow { @apply text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400; }
.member-button { @apply inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800; }
.member-button-primary { @apply inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40; }
.member-link { @apply inline-flex min-h-10 items-center px-2 py-2 text-sm font-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400; }
</style>
