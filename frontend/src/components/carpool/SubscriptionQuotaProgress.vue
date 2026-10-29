<template>
  <div class="mt-2 min-w-44 max-w-64 space-y-2" :aria-label="t('carpoolMembers.recordedQuota')">
    <div v-for="period in periods" :key="period.key" :data-test="`quota-${period.key}`">
      <div class="flex items-baseline justify-between gap-2 text-[11px] leading-4">
        <span class="text-slate-500 dark:text-slate-400">{{ t(`carpoolMembers.${period.key}Quota`) }}</span>
        <span class="text-right tabular-nums text-slate-600 dark:text-slate-300">{{ period.used === null ? '—' : money(period.used) }} / {{ period.limit === null ? '—' : period.limit === 0 ? t('carpoolMembers.unlimited') : money(period.limit) }}</span>
      </div>
      <div v-if="period.percent !== null" class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" :aria-label="t(`carpoolMembers.${period.key}Quota`)" :aria-valuenow="period.percent" :aria-valuemin="0" :aria-valuemax="100" :aria-valuetext="`${money(period.used!)} / ${money(period.limit!)}`">
        <div class="h-full rounded-full" :class="period.percent >= 90 ? 'bg-amber-500' : 'bg-blue-500'" :style="{ width: `${period.percent}%` }" />
      </div>
      <p v-if="period.window === null" class="mt-0.5 text-[10px] text-slate-400">{{ t('carpoolMembers.windowNotStarted') }}</p>
      <p v-else-if="!period.windowKnown" class="mt-0.5 text-[10px] text-slate-400">{{ t('carpoolMembers.windowUnknown') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserSubscription } from '@/types'

const props = defineProps<{ subscription: UserSubscription }>()
const { t, locale } = useI18n()
const money = (value: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const periods = computed(() => (['daily', 'weekly', 'monthly'] as const).map(key => {
  const rawUsed = props.subscription[`${key}_usage_usd`]
  const rawLimit = props.subscription.group?.[`${key}_limit_usd`]
  const used = typeof rawUsed === 'number' && Number.isFinite(rawUsed) && rawUsed >= 0 ? rawUsed : null
  // An absent group/field is unknown, not an unlimited subscription.
  const limit = rawLimit === null ? 0 : typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit >= 0 ? rawLimit : null
  return {
    key, used, limit,
    window: props.subscription[`${key}_window_start`],
    windowKnown: typeof props.subscription[`${key}_window_start`] === 'string' && Number.isFinite(Date.parse(props.subscription[`${key}_window_start`]!)),
    percent: used !== null && limit !== null && limit > 0 ? Math.min(100, Math.max(0, used / limit * 100)) : null
  }
}))
</script>
