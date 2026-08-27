import type { ErrorCategory, ErrorEvent } from '../shared/types.js'

export type UiLanguage = 'en' | 'zh'

export const labels = {
  en: { title: 'LogHUD', unknown: 'Waiting for a supported command', healthy: 'Project looks healthy', broken: 'Active errors detected', active: 'Active', resolved: 'Resolved', ignored: 'Ignored', ai: 'Explain with AI', regenerate: 'Regenerate in English', resolve: 'Mark resolved', ignore: 'Ignore', unignore: 'Stop ignoring', clear: 'Clear session', clearResolved: 'Clear resolved', details: 'Details', settings: 'Settings', settingsHint: 'Change LogHUD preferences in the Harness Settings menu.', context: 'Captured context', empty: 'No matching errors', unavailable: 'AI analysis unavailable. The error was still detected locally.', mode: 'Normal shell results are analyzed after completion. Use loghud_run for incremental monitoring.', dragHint: 'Drag to move. Alt + arrow keys also move LogHUD.', resetLayout: 'Reset position and size', category: 'Category', language: 'Language', allLanguages: 'All languages', allCategories: 'All categories', capture: 'Capture', firstSeen: 'First seen', command: 'Command', copy: 'Copy', copied: 'Copied', confidence: 'Confidence', likelyCauses: 'Likely causes', suggestedChecks: 'Suggested checks', close: 'Close', manualAi: 'Manual AI', redaction: 'Redaction', contextLimit: 'Context', activeLimit: 'Active errors', historyLimit: 'Resolved history', ignoredLimit: 'Ignored history', on: 'On', off: 'Off', lines: 'lines', cards: 'cards', search: 'Search errors', exportJson: 'Export JSON', exportMarkdown: 'Export Markdown', connection: 'Connection', connecting: 'Connecting', connected: 'Connected', reconnecting: 'Reconnecting', offline: 'Offline', oldDiagnosis: 'This explanation was generated in another language. Regenerate it for the current language.' },
  zh: { title: 'LogHUD', unknown: '等待受支持的命令', healthy: '项目当前健康', broken: '检测到活动错误', active: '活动错误', resolved: '已解决', ignored: '已忽略', ai: 'AI 帮我看懂', regenerate: '重新生成中文解释', resolve: '标记为已解决', ignore: '忽略此错误', unignore: '取消忽略', clear: '清空当前会话', clearResolved: '清除已解决', details: '详情', settings: '设置', settingsHint: '请在 Harness 设置菜单的 LogHUD 页面修改配置。', context: '已捕获上下文', empty: '没有匹配的错误', unavailable: 'AI 分析暂不可用，但错误仍已在本地检测。', mode: '普通 shell 命令会在结束后分析；使用 loghud_run 可获得增量监控。', dragHint: '拖动可调整位置，也可按 Alt + 方向键移动 LogHUD。', resetLayout: '恢复默认位置和尺寸', category: '错误分类', language: '编程语言', allLanguages: '全部语言', allCategories: '全部分类', capture: '采集方式', firstSeen: '首次发现', command: '运行命令', copy: '复制', copied: '已复制', confidence: '可信度', likelyCauses: '可能原因', suggestedChecks: '建议检查', close: '关闭', manualAi: '手动 AI 分析', redaction: '敏感信息遮盖', contextLimit: '上下文上限', activeLimit: '活动错误上限', historyLimit: '已解决记录上限', ignoredLimit: '忽略记录上限', on: '开启', off: '关闭', lines: '行', cards: '条', search: '搜索错误', exportJson: '导出 JSON', exportMarkdown: '导出 Markdown', connection: '连接状态', connecting: '正在连接', connected: '已连接', reconnecting: '正在重连', offline: '已离线', oldDiagnosis: '现有解释不是中文，请点击下方按钮重新生成中文解释。' },
} as const

export function categoryText(category: ErrorCategory, language: UiLanguage): string {
  if (language === 'en') return category
  return ({ SPRING_IOC: 'Spring 依赖注入', MYBATIS: 'MyBatis', DATABASE: '数据库', REDIS: 'Redis', HTTP: 'HTTP 请求', JAVA_RUNTIME: 'Java 运行时', NODE_RUNTIME: 'Node.js 运行时', TYPESCRIPT_COMPILE: 'TypeScript 编译', MODULE_RESOLUTION: '模块解析', BUILD_FAILURE: '构建失败', PYTHON_RUNTIME: 'Python 运行时', PYTHON_IMPORT: 'Python 导入', PYTHON_TEST_FAILURE: 'Python 测试失败', APPLICATION_STARTUP: '应用启动', UNKNOWN: '未分类' })[category]
}

export function eventSummary(event: ErrorEvent, language: UiLanguage): string {
  if (language === 'en') return event.summary
  if (event.category === 'MODULE_RESOLUTION') return `找不到模块${event.target ? `：${event.target}` : ''}`
  if (event.category === 'TYPESCRIPT_COMPILE') return `TypeScript 编译错误${event.errorCode ? `：${event.errorCode}` : ''}`
  if (event.category === 'APPLICATION_STARTUP') return event.port ? `应用启动失败：端口 ${event.port} 已被占用` : '应用启动失败'
  if (event.category === 'MYBATIS') return 'MyBatis 找不到对应的 SQL 映射语句'
  if (event.category === 'REDIS') return 'Redis 连接失败'
  if (event.category === 'PYTHON_IMPORT') return `Python 模块导入失败${event.target ? `：${event.target}` : ''}`
  if (event.category === 'PYTHON_TEST_FAILURE') return `Python 测试失败：${event.rootMessage ?? event.exceptionType}`
  if (event.category === 'PYTHON_RUNTIME') return `Python 运行时错误：${event.rootMessage ?? event.exceptionType}`
  return event.summary
}
