import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { carpoolDateRange, validCarpoolRange, type CarpoolMetric, type CarpoolPeriod } from './carpoolOverview'

export interface CarpoolFilters { period: CarpoolPeriod; metric: CarpoolMetric; start: string; end: string }
const periods = ['7d', '30d', 'month', 'custom']
const metrics = ['actual_cost', 'total_tokens', 'requests']

// Only dates and metric are shareable. Member search and account details stay local.
export function readCarpoolFilters(query: LocationQuery, now = new Date()): CarpoolFilters {
  let period: CarpoolPeriod = typeof query.cp_period === 'string' && periods.includes(query.cp_period) ? query.cp_period as CarpoolPeriod : '30d'
  const metric: CarpoolMetric = typeof query.cp_metric === 'string' && metrics.includes(query.cp_metric) ? query.cp_metric as CarpoolMetric : 'actual_cost'
  if (period === 'custom') {
    if (typeof query.cp_start === 'string' && typeof query.cp_end === 'string' && validCarpoolRange(query.cp_start, query.cp_end)) {
      return { period, metric, start: query.cp_start, end: query.cp_end }
    }
    period = '30d'
  }
  return { period, metric, ...carpoolDateRange(period, now) }
}

export function carpoolFilterQuery(query: LocationQuery, filters: CarpoolFilters): LocationQueryRaw {
  const next: LocationQueryRaw = { ...query }
  for (const key of ['cp_period', 'cp_metric', 'cp_start', 'cp_end']) delete next[key]
  if (filters.period !== '30d') next.cp_period = filters.period
  if (filters.metric !== 'actual_cost') next.cp_metric = filters.metric
  if (filters.period === 'custom' && validCarpoolRange(filters.start, filters.end)) {
    next.cp_start = filters.start
    next.cp_end = filters.end
  }
  return next
}

export function carpoolTabQuery(query: LocationQuery, tab: string): LocationQueryRaw {
  const next: LocationQueryRaw = { ...query }
  if (tab === 'overview') delete next.tab
  else next.tab = tab
  return next
}
