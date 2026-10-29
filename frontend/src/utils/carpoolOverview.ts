import type { TrendDataPoint, UserBreakdownItem } from '@/types'

export type CarpoolMetric = 'actual_cost' | 'total_tokens' | 'requests'
export type CarpoolPeriod = '7d' | '30d' | 'month' | 'custom'

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function carpoolDateRange(period: Exclude<CarpoolPeriod, 'custom'>, now = new Date()) {
  const start = new Date(now)
  if (period === 'month') start.setDate(1)
  else start.setDate(start.getDate() - (period === '7d' ? 6 : 29))
  return { start: localDate(start), end: localDate(now) }
}

export function validCarpoolRange(start: string, end: string): boolean {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const date = new Date(`${value}T12:00:00`)
    return Number.isFinite(date.getTime()) && localDate(date) === value ? date : null
  }
  const from = parse(start)
  const to = parse(end)
  return !!from && !!to && from <= to && (to.getTime() - from.getTime()) / 86400000 <= 366
}

export function summarizeCarpoolTrend(trend: TrendDataPoint[]) {
  return trend.reduce((sum, point) => ({
    actual_cost: sum.actual_cost + (Number(point.actual_cost) || 0),
    total_tokens: sum.total_tokens + (Number(point.total_tokens) || 0),
    requests: sum.requests + (Number(point.requests) || 0)
  }), { actual_cost: 0, total_tokens: 0, requests: 0 })
}

// Spreadsheet apps may execute formula-looking cells even when they are quoted.
export function safeCsvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === 'string' && (/^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text))) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function carpoolRankingCsv(rows: UserBreakdownItem[], headers: string[]): string {
  const data: (string | number)[][] = [headers, ...rows.map((row, index) => [
    index + 1, row.user_id, row.email, row.actual_cost, row.total_tokens, row.requests
  ])]
  return '\uFEFF' + data.map(row => row.map(safeCsvCell).join(',')).join('\r\n')
}
