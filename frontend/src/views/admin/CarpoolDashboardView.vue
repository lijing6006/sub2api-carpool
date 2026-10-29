<template>
  <AppLayout class="carpool-workspace">
    <div class="mx-auto max-w-[1600px] space-y-6">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div><div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" /> SUB2API / CARPOOL</div><h1 class="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{{ t('carpool.title') }}</h1><p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{{ t('carpool.description') }}</p></div>
        <span class="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z" /><path d="m8 12 3 3 5-6" /></svg>{{ t('carpool.adminOnly') }}</span>
      </header>

      <nav class="cp-panel flex gap-1 overflow-x-auto p-1.5" :aria-label="t('carpool.title')">
        <RouterLink v-for="tab in tabs" :key="tab" :to="{ path: '/admin/carpool', query: tab === 'overview' ? {} : { tab } }" class="flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500" :class="activeTab === tab ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'" :aria-current="activeTab === tab ? 'page' : undefined">{{ t(`carpool.tabs.${tab}`) }}</RouterLink>
      </nav>

      <component :is="activeComponent" :key="activeTab" />

      <p class="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-400"><svg class="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 8v4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" /></svg>{{ t('carpool.privacy') }}</p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, type AsyncComponentLoader } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import '@/styles/carpool.css'

const { t } = useI18n()
const route = useRoute()
const tabs = ['overview', 'members'] as const
type Tab = typeof tabs[number]
const activeTab = computed<Tab>(() => typeof route.query.tab === 'string' && tabs.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'overview')
const loadingComponent = defineComponent({ setup: () => () => h('div', { class: 'cp-panel p-12 text-center text-sm text-slate-500', role: 'status' }, t('carpool.loading')) })
const errorComponent = defineComponent({ setup: () => () => h('div', { class: 'cp-panel p-8 text-sm text-red-600', role: 'alert' }, t('carpool.loadError')) })
const asyncPanel = (loader: AsyncComponentLoader) => defineAsyncComponent({ loader, loadingComponent, errorComponent, delay: 120, timeout: 30000 })
const components = {
  overview: asyncPanel(() => import('@/components/carpool/CarpoolOverview.vue')),
  members: asyncPanel(() => import('@/components/carpool/SubscriptionMembersPanel.vue'))
}
const activeComponent = computed(() => components[activeTab.value])
</script>
