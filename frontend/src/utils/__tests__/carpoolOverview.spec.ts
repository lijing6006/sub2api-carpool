import { describe, expect, it } from 'vitest'
import { carpoolDateRange, validCarpoolRange, safeCsvCell, summarizeCarpoolTrend, carpoolRankingCsv, carpoolTrendCsv } from '../carpoolOverview'
import type { TrendDataPoint, UserBreakdownItem } from '@/types'

describe('carpool statistics helpers', () => {
  it('uses inclusive local dates, including month boundaries', () => {
    expect(carpoolDateRange('7d', new Date(2026, 0, 3, 23))).toEqual({ start: '2025-12-28', end: '2026-01-03' })
    expect(carpoolDateRange('month', new Date(2026, 9, 28))).toEqual({ start: '2026-10-01', end: '2026-10-28' })
    expect(carpoolDateRange('30d', new Date(2026, 9, 28))).toEqual({ start: '2026-09-29', end: '2026-10-28' })
  })
  it.each([
    ['2026-02-30', '2026-03-01'], ['2026-10-29', '2026-10-28'],
    ['', '2026-10-28'], ['2020-01-01', '2026-10-28'], ['2026-1-1', '2026-01-02']
  ])('rejects invalid or excessively expensive ranges: %s to %s', (start, end) => {
    expect(validCarpoolRange(start, end)).toBe(false)
  })
  it('allows same-day ranges and a leap day', () => {
    expect(validCarpoolRange('2028-02-29', '2028-02-29')).toBe(true)
  })
  it('adds full daily totals, not just a truncated member ranking', () => {
    const points = [{ actual_cost: 0.25, total_tokens: 100, requests: 2 }, { actual_cost: 0.75, total_tokens: 300, requests: 5 }] as TrendDataPoint[]
    expect(summarizeCarpoolTrend(points)).toEqual({ actual_cost: 1, total_tokens: 400, requests: 7 })
    expect(summarizeCarpoolTrend([])).toEqual({ actual_cost: 0, total_tokens: 0, requests: 0 })
  })
  it.each(['=HYPERLINK("bad")', '+cmd', '-cmd', '@sum(A1)', '\tformula', '  =bad', '\n=bad'])('neutralizes spreadsheet formulas: %s', value => {
    expect(safeCsvCell(value).startsWith('"\'')).toBe(true)
  })
  it('quotes literal data and never changes numeric cell semantics', () => {
    expect(safeCsvCell('alice@example.com')).toBe('"alice@example.com"')
    expect(safeCsvCell('a,"b"')).toBe('"a,""b"""')
    expect(safeCsvCell(-1)).toBe('"-1"')
  })
  it('exports a UTF-8 CSV with no API key or prompt fields', () => {
    const csv = carpoolRankingCsv([{ user_id: 4, email: '=evil', actual_cost: 2, total_tokens: 80, requests: 3 }] as UserBreakdownItem[], ['rank', 'id', 'member', 'cost', 'tokens', 'requests'])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"\'=evil"')
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).not.toMatch(/api_key|prompt/)
  })
  it('exports full daily aggregates independently of truncated member rankings', () => {
    const rows = [{ date: '2026-10-28', actual_cost: 2.125, total_tokens: 9000, requests: 44, api_key: 'never-export' }] as unknown as TrendDataPoint[]
    const csv = carpoolTrendCsv(rows, ['date', 'charge', 'tokens', 'requests'])
    expect(csv).toBe('\uFEFF"date","charge","tokens","requests"\r\n"2026-10-28","2.125","9000","44"')
    expect(csv).not.toContain('never-export')
  })
  it('exports empty trend headers only and escapes string cells', () => {
    expect(carpoolTrendCsv([], ['date'])).toBe('\uFEFF"date"')
    const csv = carpoolTrendCsv([{ date: '=formula', actual_cost: 0, total_tokens: 0, requests: 0 }] as TrendDataPoint[], ['date'])
    expect(csv).toContain('"\'=formula"')
  })

})
