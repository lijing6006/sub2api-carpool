export default {
  title: 'Carpool workspace',
  description: 'Shared access. Clear usage. Everything your team needs in one place.',
  adminOnly: 'Administrator workspace',
  privacy: 'Cross-member statistics are administrator-only. No request content or API credentials are shown.',
  tabs: { overview: 'Overview & rankings', members: 'Members & subscriptions', temporary: 'Temporary accounts', diagnostics: 'Model diagnostics' },
  loading: 'Loading workspace…',
  loadError: 'This workspace could not be loaded. Refresh the page to try again.',
  overview: {
    filterLinkHint: 'Dates and metric are preserved in this page link across management tabs. Member search stays local.',
    filterLinkError: 'The page link could not be updated. Filters still work, but a reload may reset them.',
    title: 'Usage overview', subtitle: 'Understand your members’ consumption without changing the way billing works.',
    period: 'Period', periods: { '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', custom: 'Custom range' },
    start: 'Start date', end: 'End date', apply: 'Apply dates', invalidRange: 'Choose valid dates in order, no more than 366 days apart.',
    refresh: 'Refresh', refreshing: 'Updating…', retry: 'Try again', export: 'Export CSV',
    actual_cost: 'Actual charge', total_tokens: 'Tokens', requests: 'Requests', activeMembers: 'Active members',
    chargedHint: 'User charges, not subscription procurement costs', requestsHint: 'All recorded requests in this period', tokensHint: 'Input, output and cache tokens', membersHint: 'Members with recorded usage; at most 200 returned',
    trend: 'Daily consumption', trendHint: 'One metric per axis. Dates use your browser timezone.',
    models: 'Model cost share', modelsHint: 'Actual user charges by requested model', others: 'Other models',
    ranking: 'Member usage ranking', rankingHint: 'Top 200 members for the selected metric. Members with zero usage are in Members & subscriptions.',
    search: 'Search returned members', searchHint: 'Search by email or member ID', rank: 'Rank', member: 'Member', userId: 'Member ID', share: 'Share of period total', details: 'View usage',
    noData: 'No recorded usage for this period', noDataHint: 'Usage will appear here after members make requests. Nothing is estimated or generated.',
    noMatches: 'No matching members in these results', error: 'Usage data could not be loaded. Check your connection and try again.', rankingError: 'The member ranking could not be loaded. The other statistics are still available.',
    updated: 'Last updated', timezone: 'Timezone', scope: 'Usage scope', scopeHint: 'This is an administrator-wide view, not an isolated tenant or a separate shared budget.',
    billing: 'Billing explained', billingHint: 'Actual charge means the amount charged to a member. A balance is not a subscription quota. No shared monthly budget is assumed.',
    truncated: '200 results returned. More members may exist; this is not an exhaustive list.',
    metric: 'Metric', unknown: 'Not available', showing: '{count} members shown', csvNotice: 'Exports the returned ranking only, in its current metric order.'
  }
}
