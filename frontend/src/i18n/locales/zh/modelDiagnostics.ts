export default {
  exportJson: '下载 JSON',
  exportCsv: '下载 CSV',
  exportPrivacy: '只导出本会话最多八次检测的指标、账号名称与固定小题结果，不包含提示词、响应正文或密钥。账号名称仍属管理信息，请谨慎分享；取消/失败也可能产生上游费用。',
  exportError: '下载未能启动，请重试；检测记录仍保留在本会话。',
  outcomes: { completed: '已完成', failed: '失败 / 未测得', cancelled: '已取消 / 可用性未知' },

  eyebrow: 'MODEL LAB', title: '模型质量与延迟检测', description: '使用已配置的上游账号，执行一次小型、可复现的文本检测。分别观察可用性、响应速度和固定题目正确性。',
  manualOnly: '仅手动检测 · 不后台轮询', account: '上游账号', model: '文本模型', chooseAccount: '请选择账号', chooseModel: '请选择模型', loading: '加载中…',
  accountScope: '支持已配置的 Anthropic、OpenAI、Gemini 账号，不含 Bedrock。', modelScope: '仅文本生成，不测试图片、音频或视频。', previousPage: '上一页账号', nextPage: '下一页账号',
  metadataError: '无法加载已配置的账号或模型。', retry: '重试', noAccounts: '本页暂无支持的账号。请先在账号管理中添加上游账号，或切换账号分页。', noModels: '此账号未返回可检测的文本模型。',
  costWarning: '真实检测会消耗上游额度，并可能产生费用。', costDetail: '每次运行发送一个固定文本题目，请求最长持续 60 秒；多数接口另设较小输出上限。停止检测不能撤销上游已经产生的用量或扣费。', confirmCost: '我了解可能产生费用，并授权本次检测。',
  run: '运行一次检测', running: '检测中…', cancel: '停止检测', runningHint: '正在等待所选上游响应，不会测试其他账号。', cancelled: '已停止。上游已经产生的用量仍可能计费。', completedHint: '检测完成；再次运行将重新发起可能计费的请求。', idleHint: '只有确认并点击运行后，才会发起真实检测。',
  availability: '可用性', available: '响应正常', unavailable: '不可用', availabilityHint: '表示本次成功返回文本，不代表可用率承诺。', ttft: '首字延迟 · TTFT', ttftHint: '服务器观察到首个文本块的耗时。', total: '总耗时', totalHint: '从服务器开始检测到流式响应完成。', throughput: '生成吞吐', tokensUnavailable: '上游未返回输出 Token 用量时不显示。', outputTokens: '上游报告 {count} 个输出 Token',
  qualityTitle: '固定题目正确性', qualityScope: 'JSON + 算术 + 排序 · 规则 v1', notMeasured: '未检测', passed: '通过', notPassed: '未通过',
  checks: { format: '严格 JSON，且仅包含指定的两个字段', arithmetic: '17 + 25 的数值结果为 42', sorting: '升序排列严格为 [1, 2, 3]' },
  rubric: '三项检查等权计分。100 分仅表示此固定题目全部通过，不代表综合智能、安全性或稳定性。延迟不参与评分，请求失败不评分。', fixture: '查看完整题目与期望结果',
  measurementTitle: '如何理解这些数字', timingExplanation: '首字延迟包含服务端准备时间和上游往返，不是纯模型计算时间；流式代理的缓冲也会影响结果。', tokensExplanation: '吞吐使用上游报告的输出 Token 数，除以首字到完成的时间。“—”表示无法测量，绝不按字符数估算。', privacyExplanation: '只发送这里公开的固定题目，不展示账号凭证、成员请求内容、上游原始错误或模型生成原文。', limitsExplanation: '固定题目、60 秒超时和 4 KB 流式输出限制约束检测范围。Codex OAuth 不接受输出 Token 上限。不会自动创建定时检测。',
  historyTitle: '本次会话检测记录', historyScope: '最多保留 8 次完成结果，仅保存在此页面内存中。', clearHistory: '清空', emptyHistory: '尚未检测。请选择模型并授权一次检测，查看真实指标。', completed: '完成时间',
  errors: { unauthorized: '需要管理员权限，请重新登录后再检测。', request: '检测失败，请检查所选账号和模型。为避免泄露信息，不展示上游原始错误。', network: '连接失败，未记录结果。请检查网络后再重试。', incomplete: '流式响应未完整结束，不计算正确性分数。', outputLimit: '响应超过安全限制，不计算正确性分数。', unsupported: '后端未提供本检测面板所需元数据，请使用配套后端版本。', timeout: '检测超时，不计算正确性分数；上游已产生的用量仍可能计费。' }
}
