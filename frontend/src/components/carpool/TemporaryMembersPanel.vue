<template>
  <section class="space-y-5" aria-labelledby="temporary-members-heading">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 id="temporary-members-heading" class="text-xl font-semibold text-slate-900 dark:text-white">{{ t('tempMembers.title') }}</h2>
        <p class="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{{ t('tempMembers.subtitle') }}</p>
      </div>
      <button class="btn btn-primary" data-testid="temporary-create" :disabled="saving" @click="openCreate">{{ t('tempMembers.create') }}</button>
    </div>

    <div class="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
      <p>{{ t('tempMembers.limitsHint') }}</p>
      <p class="mt-1 font-medium">{{ t('tempMembers.softLimit') }}</p>
      <p class="mt-1 text-xs text-blue-700 dark:text-blue-300">{{ t('tempMembers.unsupported') }}</p>
    </div>

    <form v-if="formOpen" class="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900 dark:bg-dark-800" data-testid="temporary-form" @submit.prevent="save">
      <h3 class="mb-4 font-semibold text-slate-900 dark:text-white">{{ editing ? t('tempMembers.edit') : t('tempMembers.create') }}</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <div><label class="label" for="temporary-email">{{ t('tempMembers.email') }}</label><input id="temporary-email" v-model="form.email" class="input" type="email" required :disabled="!!editing || saving" autocomplete="off" /></div>
        <div><label class="label" for="temporary-name">{{ t('tempMembers.username') }}</label><input id="temporary-name" v-model="form.username" class="input" maxlength="100" :disabled="!!editing || saving" autocomplete="off" /></div>
        <div v-if="!editing"><label class="label" for="temporary-password">{{ t('tempMembers.password') }}</label><input id="temporary-password" v-model="form.password" class="input" type="password" required minlength="12" maxlength="72" :disabled="saving" autocomplete="new-password" /></div>
        <div><label class="label" for="temporary-expiry">{{ t('tempMembers.expiryInput') }}</label><input id="temporary-expiry" v-model="form.expires" class="input" type="datetime-local" required :disabled="saving" /></div>
        <div><label class="label" for="temporary-budget">{{ t('tempMembers.budgetInput') }}</label><input id="temporary-budget" v-model.number="form.budget" class="input" type="number" required min="0.01" max="1000000" step="0.01" :disabled="saving" /></div>
        <div v-if="!editing"><label class="label" for="temporary-balance">{{ t('tempMembers.initialBalance') }}</label><input id="temporary-balance" v-model.number="form.balance" class="input" type="number" required min="0" :max="form.budget" step="0.01" :disabled="saving" /></div>
      </div>
      <p class="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{{ t('tempMembers.balanceHint') }} {{ t('tempMembers.accessHint') }}</p>
      <p v-if="formError" role="alert" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ formError }}</p>
      <div class="mt-5 flex flex-wrap justify-end gap-3">
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="closeForm">{{ t('tempMembers.cancel') }}</button>
        <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? t('tempMembers.saving') : editing ? t('tempMembers.save') : t('tempMembers.creating') }}</button>
      </div>
    </form>

    <p v-if="notice" role="status" class="text-sm text-emerald-600 dark:text-emerald-400">{{ notice }}</p>
    <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-800">
      <form class="flex flex-wrap gap-3 border-b border-slate-100 p-4 dark:border-dark-700" @submit.prevent="search">
        <input v-model="searchInput" class="input min-w-0 flex-1 md:max-w-sm" :placeholder="t('tempMembers.search')" :aria-label="t('tempMembers.search')" maxlength="100" />
        <button type="submit" class="btn btn-secondary">{{ t('tempMembers.searchButton') }}</button>
        <button type="button" class="btn btn-secondary ml-auto" :disabled="loading" @click="load">{{ t('tempMembers.refresh') }}</button>
      </form>
      <div v-if="loadError" role="alert" class="p-5 text-sm text-red-600 dark:text-red-400">{{ t('tempMembers.error') }}</div>
      <p v-if="loading" role="status" class="px-5 py-3 text-sm text-slate-500">{{ t('tempMembers.loading') }}</p>
      <div v-if="!loading && !loadError && !members.length" class="px-6 py-14 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-500 dark:bg-blue-900/30" aria-hidden="true">◷</div>
        <p class="font-medium text-slate-900 dark:text-white">{{ t('tempMembers.empty') }}</p>
        <p class="mx-auto mt-2 max-w-md text-sm text-slate-500">{{ t('tempMembers.emptyHint') }}</p>
      </div>
      <div v-else-if="members.length" class="overflow-x-auto" :aria-busy="loading">
        <table class="w-full min-w-[780px] text-left text-sm">
          <thead class="bg-slate-50/70 text-xs text-slate-500 dark:bg-dark-900/40 dark:text-slate-400"><tr>
            <th class="px-5 py-3 font-medium">{{ t('tempMembers.member') }}</th><th class="px-5 py-3 font-medium">{{ t('tempMembers.expires') }}</th><th class="px-5 py-3 font-medium">{{ t('tempMembers.spending') }}</th><th class="px-5 py-3 font-medium">{{ t('tempMembers.balance') }}</th><th class="px-5 py-3 font-medium">{{ t('tempMembers.status') }}</th><th class="px-5 py-3 font-medium">{{ t('tempMembers.actions') }}</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-dark-700"><tr v-for="member in members" :key="member.id">
            <td class="px-5 py-4"><p class="font-medium text-slate-900 dark:text-white">{{ member.username || member.email }}</p><p v-if="member.username" class="mt-1 text-xs text-slate-500">{{ member.email }}</p></td>
            <td class="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">{{ date(member.temporary_expires_at) }}</td>
            <td class="min-w-44 px-5 py-4"><p class="tabular-nums text-slate-800 dark:text-slate-100">{{ money(member.temporary_spent_usd) }} <span class="text-slate-400">/ {{ money(member.temporary_budget_usd) }}</span></p><div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-700" role="progressbar" :aria-valuenow="progress(member)" aria-valuemin="0" aria-valuemax="100" :aria-label="t('tempMembers.spending')"><div class="h-full rounded-full" :class="progress(member) >= 100 ? 'bg-amber-500' : 'bg-blue-500'" :style="{ width: `${progress(member)}%` }" /></div></td>
            <td class="px-5 py-4 tabular-nums text-slate-600 dark:text-slate-300">{{ money(member.balance) }}</td>
            <td class="px-5 py-4"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" :class="status(member) === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'">{{ t(`tempMembers.${status(member)}`) }}</span></td>
            <td class="px-5 py-4"><div class="flex flex-col items-start gap-2"><button class="font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400" :disabled="saving || busyMember !== null" @click="openEdit(member)">{{ t('tempMembers.edit') }}</button><button class="text-xs text-slate-500 hover:underline disabled:opacity-50" :disabled="saving || busyMember !== null" @click="toggle(member)">{{ member.status === 'disabled' ? t('tempMembers.enable') : t('tempMembers.disable') }}</button></div></td>
          </tr></tbody>
        </table>
      </div>
      <div v-if="total > 0" class="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-dark-700">
        <span>{{ t('tempMembers.page', { page, total }) }}</span><div class="flex gap-2"><button class="btn btn-secondary" :disabled="loading || page <= 1" @click="changePage(-1)">{{ t('tempMembers.previous') }}</button><button class="btn btn-secondary" :disabled="loading || page >= pages" @click="changePage(1)">{{ t('tempMembers.next') }}</button></div>
      </div>
    </div>
    <p v-if="actionError" role="alert" class="text-sm text-red-600 dark:text-red-400">{{ actionError }}</p>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createTemporaryMember, listTemporaryMembers, updateTemporaryMember, type TemporaryMember } from '@/api/admin/temporaryMembers'

const { t, locale } = useI18n()
const members = ref<TemporaryMember[]>([])
const loading = ref(false)
const loadError = ref(false)
const formOpen = ref(false)
const editing = ref<TemporaryMember | null>(null)
const saving = ref(false)
const busyMember = ref<number | null>(null)
const formError = ref('')
const actionError = ref('')
const notice = ref('')
const searchInput = ref('')
const query = ref('')
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const form = reactive({ email: '', username: '', password: '', expires: '', budget: 10, balance: 0 })
let controller: AbortController | null = null
let sequence = 0
let alive = true

function localInput(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
function closeForm() {
  if (saving.value) return
  formOpen.value = false
  editing.value = null
  form.password = ''
  formError.value = ''
}
function openCreate() {
  editing.value = null
  Object.assign(form, { email: '', username: '', password: '', expires: localInput(new Date(Date.now() + 7 * 86400_000)), budget: 10, balance: 0 })
  formError.value = ''
  formOpen.value = true
}
function openEdit(member: TemporaryMember) {
  editing.value = member
  Object.assign(form, { email: member.email, username: member.username, password: '', expires: localInput(new Date(member.temporary_expires_at)), budget: member.temporary_budget_usd, balance: member.balance })
  formError.value = ''
  formOpen.value = true
}
async function load() {
  const current = ++sequence
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  loadError.value = false
  try {
    const result = await listTemporaryMembers(page.value, query.value, controller.signal)
    if (!alive || current !== sequence) return
    members.value = result.items
    total.value = result.total
    pages.value = result.pages
  } catch {
    if (alive && current === sequence && !controller.signal.aborted) loadError.value = true
  } finally {
    if (alive && current === sequence) loading.value = false
  }
}
function search() { query.value = searchInput.value.trim(); page.value = 1; void load() }
function changePage(delta: number) { page.value += delta; void load() }
function status(member: TemporaryMember): 'active' | 'expired' | 'exhausted' | 'disabled' {
  if (member.status === 'disabled') return 'disabled'
  if (Date.parse(member.temporary_expires_at) <= Date.now()) return 'expired'
  if (member.temporary_spent_usd >= member.temporary_budget_usd) return 'exhausted'
  return 'active'
}
function progress(member: TemporaryMember) { return Math.max(0, Math.min(100, member.temporary_budget_usd > 0 ? member.temporary_spent_usd / member.temporary_budget_usd * 100 : 0)) }
function money(value: number) { return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value) }
function date(value: string) { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
async function save() {
  if (saving.value) return
  formError.value = ''
  const expires = new Date(form.expires)
  const maximum = new Date(); maximum.setFullYear(maximum.getFullYear() + 1)
  if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now() || expires > maximum) { formError.value = t('tempMembers.invalidExpiry'); return }
  if (!Number.isFinite(form.budget) || form.budget <= 0 || form.budget > 1_000_000) { formError.value = t('tempMembers.invalidBudget'); return }
  if (!editing.value) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { formError.value = t('tempMembers.invalidEmail'); return }
    if (form.password.length < 12) { formError.value = t('tempMembers.invalidPassword'); return }
    if (!Number.isFinite(form.balance) || form.balance < 0 || form.balance > form.budget) { formError.value = t('tempMembers.invalidBalance'); return }
  }
  saving.value = true
  notice.value = ''
  try {
    const limits = { temporary_expires_at: expires.toISOString(), temporary_budget_usd: form.budget }
    if (editing.value) await updateTemporaryMember(editing.value.id, limits)
    else await createTemporaryMember({ ...limits, email: form.email.trim(), username: form.username.trim(), password: form.password, balance: form.balance })
    if (!alive) return
    form.password = ''
    formOpen.value = false
    editing.value = null
    notice.value = t('tempMembers.saved')
    page.value = 1
    await load()
  } catch {
    if (alive) formError.value = t('tempMembers.saveError')
  } finally { if (alive) saving.value = false }
}
async function toggle(member: TemporaryMember) {
  if (busyMember.value !== null || saving.value) return
  busyMember.value = member.id
  actionError.value = ''
  try {
    await updateTemporaryMember(member.id, { status: member.status === 'disabled' ? 'active' : 'disabled' })
    if (alive) await load()
  } catch { if (alive) actionError.value = t('tempMembers.saveError') }
  finally { if (alive) busyMember.value = null }
}
onMounted(load)
onBeforeUnmount(() => { alive = false; ++sequence; controller?.abort(); form.password = '' })
</script>
