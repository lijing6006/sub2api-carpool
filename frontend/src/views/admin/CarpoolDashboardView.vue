<template>
  <AppLayout class="carpool-workspace">
    <div class="mx-auto max-w-[1600px] space-y-6">
      <header class="cp-workspace-header">
        <div class="min-w-0">
          <div class="cp-eyebrow"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" /> {{ t('carpool.navigation.workspace') }} <span class="cp-edition">CARPOOL · V19</span></div>
          <h1 class="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{{ activeTab === 'overview' ? t('carpool.overview.title') : t(`carpool.tabs.${activeTab}`) }}</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{{ t(`carpool.workspace.descriptions.${activeTab}`) }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <span class="cp-admin-badge"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z" /><path d="m8 12 3 3 5-6" /></svg>{{ t('carpool.adminOnly') }}</span>
          <RouterLink :to="{ path: '/admin/carpool', query: carpoolTabQuery(route.query, 'members') }" class="cp-primary inline-flex items-center gap-2" data-test="manage-members"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{{ t('carpool.workspace.manageMembers') }}</RouterLink>
        </div>
      </header>

      <nav class="cp-workflow-nav" :aria-label="t('carpool.navigation.workspace')">
        <RouterLink v-for="tab in tabs" :key="tab" :to="{ path: '/admin/carpool', query: carpoolTabQuery(route.query, tab) }" class="cp-workflow-link" :class="{ 'is-active': activeTab === tab }" :aria-current="activeTab === tab ? 'page' : undefined" :data-test="`workspace-${tab}`">
          <span class="cp-workflow-icon" aria-hidden="true"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="tabIcons[tab]" /></svg></span>
          <span class="min-w-0"><span class="block text-sm font-semibold">{{ t(`carpool.tabs.${tab}`) }}</span><span class="cp-workflow-hint">{{ t(`carpool.workspace.hints.${tab}`) }}</span></span>
          <svg class="ml-auto h-4 w-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </RouterLink>
      </nav>

      <component :is="activeComponent" :key="activeTab" />
      <MemberAttentionPanel v-if="activeTab === 'overview'" />

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
import { carpoolTabQuery } from '@/utils/carpoolFilters'

const { t } = useI18n()
const route = useRoute()
const tabs = ['overview', 'members', 'temporary', 'diagnostics'] as const
const tabIcons = {
  overview: 'M3 12 12 3l9 9M5 10v10h14V10M9 20v-7h6v7',
  members: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  temporary: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  diagnostics: 'M3 12h4l3-8 4 16 3-8h4'
}
type Tab = typeof tabs[number]
const activeTab = computed<Tab>(() => typeof route.query.tab === 'string' && tabs.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'overview')
const loadingComponent = defineComponent({ setup: () => () => h('div', { class: 'cp-panel p-12 text-center text-sm text-slate-500', role: 'status' }, t('carpool.loading')) })
const errorComponent = defineComponent({ setup: () => () => h('div', { class: 'cp-panel p-8 text-sm text-red-600', role: 'alert' }, t('carpool.loadError')) })
const asyncPanel = (loader: AsyncComponentLoader) => defineAsyncComponent({ loader, loadingComponent, errorComponent, delay: 120, timeout: 30000 })
const MemberAttentionPanel = asyncPanel(() => import('@/components/carpool/MemberAttentionPanel.vue'))
const components = {
  overview: asyncPanel(() => import('@/components/carpool/CarpoolOverview.vue')),
  members: asyncPanel(() => import('@/components/carpool/SubscriptionMembersPanel.vue')),
  temporary: asyncPanel(() => import('@/components/carpool/TemporaryMembersPanel.vue')),
  diagnostics: asyncPanel(() => import('@/components/carpool/ModelDiagnosticsPanel.vue'))
}
const activeComponent = computed(() => components[activeTab.value])
</script>
