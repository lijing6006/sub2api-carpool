export default {
  title: '拼车管理',
  description: '共享更轻松，用量更透明。一个工作台，管理每位成员。',
  adminOnly: '管理员工作台',
  privacy: '跨成员统计仅管理员可见，不展示请求内容、API 密钥或上游凭证。',
  tabs: { overview: '总览与排行', members: '成员与订阅', temporary: '临时账号', diagnostics: '模型检测' },
  loading: '正在加载工作台…',
  loadError: '工作台加载失败，请刷新页面重试。',
  overview: {
    dailyDetails: '查看每日明细',
    dailyDetailsHint: '图表的同一份真实数据，便于键盘阅读与逐日对账；不受成员榜前 200 名限制。',
    exportTrend: '下载每日汇总 CSV',
    date: '日期',

    filterLinkHint: '时段与指标保存在页面链接中，切换管理页后仍保留。成员搜索不会写入链接。',
    filterLinkError: '无法更新页面链接；当前筛选仍可使用，但刷新页面可能丢失。',
    title: '拼车总览', subtitle: '看清每位成员的消耗，让共享更透明，不改变原有计费规则。',
    period: '统计周期', periods: { '7d': '近 7 天', '30d': '近 30 天', month: '本月', custom: '自定义区间' },
    start: '开始日期', end: '结束日期', apply: '应用日期', invalidRange: '请选择有效且先后正确的日期，间隔不超过 366 天。',
    refresh: '刷新', refreshing: '更新中…', retry: '重试', export: '导出 CSV',
    actual_cost: '实际扣费', total_tokens: 'Token 总量', requests: '请求数', activeMembers: '活跃成员',
    chargedHint: '用户实际扣费，不等于订阅采购账单', requestsHint: '本周期所有已记录的请求', tokensHint: '包括输入、输出与缓存 Token', membersHint: '本期有用量记录的成员，最多返回 200 人',
    trend: '每日消耗趋势', trendHint: '每次只展示一种指标，日期采用浏览器时区。',
    models: '模型费用占比', modelsHint: '按请求模型统计用户实际扣费', others: '其他模型',
    ranking: '成员用量排行', rankingHint: '按所选指标展示 Top 200；零用量成员请在「成员与订阅」中查看。',
    search: '搜索已返回的成员', searchHint: '输入邮箱或成员 ID', rank: '排名', member: '成员', userId: '成员 ID', share: '占本期总量', details: '查看用量',
    noData: '这个周期还没有用量记录', noDataHint: '成员发起请求后，真实用量会展示在这里，不填充模拟或估算数据。',
    noMatches: '当前结果中没有匹配的成员', error: '用量数据加载失败，请检查连接后重试。', rankingError: '成员排行加载失败，其他统计仍然可用。',
    updated: '最后更新', timezone: '统计时区', scope: '统计范围', scopeHint: '这里展示管理员可查看的全站成员，不代表已经建立独立租户或共享预算。',
    billing: '账单口径', billingHint: '实际扣费指成员被计收的金额；余额不等于订阅额度，也不假定存在统一月预算。',
    truncated: '已返回 200 条，可能还有更多成员；此列表不是完整成员清单。',
    metric: '指标', unknown: '暂无数据', showing: '当前展示 {count} 位成员', csvNotice: '仅导出当前返回的排行，按当前指标排序。'
  }
}
