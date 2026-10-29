import { describe, expect, it } from 'vitest'
import { carpoolFilterQuery, carpoolTabQuery, readCarpoolFilters } from '../carpoolFilters'
const now = new Date(2026, 9, 28, 12)
describe('carpool shareable filters', () => {
  it('defaults safely without query state', () => expect(readCarpoolFilters({}, now)).toEqual({ period: '30d', metric: 'actual_cost', start: '2026-09-29', end: '2026-10-28' }))
  it('restores a supported metric and relative range', () => expect(readCarpoolFilters({ cp_period: '7d', cp_metric: 'requests' }, now)).toEqual({ period: '7d', metric: 'requests', start: '2026-10-22', end: '2026-10-28' }))
  it('restores valid fixed custom dates', () => expect(readCarpoolFilters({ cp_period: 'custom', cp_metric: 'total_tokens', cp_start: '2026-10-01', cp_end: '2026-10-10' }, now)).toEqual({ period: 'custom', metric: 'total_tokens', start: '2026-10-01', end: '2026-10-10' }))
  it.each([
    { cp_start: '2026-02-30', cp_end: '2026-03-02' },
    { cp_start: '2026-10-29', cp_end: '2026-10-01' },
    { cp_start: '2020-01-01', cp_end: '2026-10-01' },
    { cp_start: ['2026-10-01'], cp_end: '2026-10-28' },
    {}
  ])('rejects invalid, oversized or repeated custom dates %j', dates => expect(readCarpoolFilters({ cp_period: 'custom', ...dates }, now).period).toBe('30d'))
  it('rejects unsupported or repeated query selectors', () => expect(readCarpoolFilters({ cp_period: ['7d'], cp_metric: '<script>' }, now)).toEqual(readCarpoolFilters({}, now)))
  it('keeps unrelated tab while removing stale custom dates', () => expect(carpoolFilterQuery({ tab: 'members', cp_start: 'old', cp_end: 'old' }, readCarpoolFilters({}, now))).toEqual({ tab: 'members' }))
  it('writes only approved selection fields, never member search', () => expect(carpoolFilterQuery({}, { period: 'custom', metric: 'requests', start: '2026-10-01', end: '2026-10-10' })).toEqual({ cp_period: 'custom', cp_metric: 'requests', cp_start: '2026-10-01', cp_end: '2026-10-10' }))
  it('keeps filters when changing tabs and returning to overview', () => {
    expect(carpoolTabQuery({ cp_period: '7d' }, 'members')).toEqual({ cp_period: '7d', tab: 'members' })
    expect(carpoolTabQuery({ cp_period: '7d', tab: 'members' }, 'overview')).toEqual({ cp_period: '7d' })
  })
})
