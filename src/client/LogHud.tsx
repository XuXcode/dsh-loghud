import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { ErrorEvent, SessionSnapshot } from '../shared/types.js'
import { clearAll, clearResolved, diagnose, getSnapshot, resolveError, subscribe } from './api.js'

const labels = {
  en: { title: 'LogHUD', unknown: 'Waiting for a supported command', healthy: 'Project looks healthy', broken: 'Active errors detected', active: 'Active errors', resolved: 'Resolved history', ai: 'Explain with AI', regenerate: 'Regenerate in English', resolve: 'Mark resolved', clear: 'Clear session', clearResolved: 'Clear resolved', details: 'Details', settings: 'Settings', context: 'Captured context', empty: 'No errors detected', unavailable: 'AI analysis unavailable. The error was still detected locally.', mode: 'Normal shell results are analyzed after completion. Use loghud_run for incremental monitoring.', dragHint: 'Drag to move. Alt + arrow keys also move LogHUD.', resetPosition: 'Reset LogHUD position', category: 'Category', capture: 'Capture', firstSeen: 'First seen', command: 'Command', copy: 'Copy', confidence: 'Confidence', likelyCauses: 'Likely causes', suggestedChecks: 'Suggested checks', close: 'Close', manualAi: 'Manual AI', redaction: 'Redaction', contextLimit: 'Context', historyLimit: 'History', on: 'On', off: 'Off', lines: 'lines', cards: 'cards', oldDiagnosis: 'This explanation was generated in another language. Regenerate it for the current language.' },
  zh: { title: 'LogHUD', unknown: '等待受支持的命令', healthy: '项目当前健康', broken: '检测到活动错误', active: '活动错误', resolved: '已解决历史', ai: 'AI 帮我看懂', regenerate: '重新生成中文解释', resolve: '标记为已解决', clear: '清空当前会话', clearResolved: '清除已解决', details: '详情', settings: '设置', context: '已捕获上下文', empty: '尚未检测到错误', unavailable: 'AI 分析暂不可用，但错误仍已在本地检测。', mode: '普通 shell 命令会在结束后分析；使用 loghud_run 可获得增量监控。', dragHint: '拖动可调整位置，也可按 Alt + 方向键移动 LogHUD。', resetPosition: '恢复默认位置', category: '错误分类', capture: '采集方式', firstSeen: '首次发现', command: '运行命令', copy: '复制', confidence: '可信度', likelyCauses: '可能原因', suggestedChecks: '建议检查', close: '关闭', manualAi: '手动 AI 分析', redaction: '敏感信息遮盖', contextLimit: '上下文上限', historyLimit: '历史记录上限', on: '开启', off: '关闭', lines: '行', cards: '条', oldDiagnosis: '现有解释不是中文，请点击下方按钮重新生成中文解释。' },
} as const

interface HudPosition { x: number; y: number }
interface HudSize { width: number; height: number }
interface ViewportSize { width: number; height: number }
interface DragState extends HudSize { pointerId: number; startX: number; startY: number; originX: number; originY: number }

const HUD_POSITION_KEY = 'dsh-loghud:position:v1'
const HUD_EDGE_GAP = 8

export function clampHudPosition(position: HudPosition, size: HudSize, viewport: ViewportSize): HudPosition {
  return {
    x: Math.min(Math.max(HUD_EDGE_GAP, position.x), Math.max(HUD_EDGE_GAP, viewport.width - size.width - HUD_EDGE_GAP)),
    y: Math.min(Math.max(HUD_EDGE_GAP, position.y), Math.max(HUD_EDGE_GAP, viewport.height - size.height - HUD_EDGE_GAP)),
  }
}

function readStoredPosition(): HudPosition | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const value = JSON.parse(window.localStorage.getItem(HUD_POSITION_KEY) ?? 'null') as Partial<HudPosition> | null
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return { x: Number(value.x), y: Number(value.y) }
  } catch { /* Ignore stale or blocked browser storage. */ }
  return undefined
}

function storePosition(position: HudPosition | undefined): void {
  try {
    if (position) window.localStorage.setItem(HUD_POSITION_KEY, JSON.stringify(position))
    else window.localStorage.removeItem(HUD_POSITION_KEY)
  } catch { /* Position persistence is optional. */ }
}

export function LogHudOverlay({ useSessions }: { useSessions: SnapshotSelectorHook<SessionListState> }) {
  const sessionId = useSessions((state) => state.current)
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<SessionSnapshot>()
  const [selected, setSelected] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const [position, setPosition] = useState<HudPosition | undefined>(readStoredPosition)
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState>()
  const draggedRef = useRef(false)
  const language = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  const diagnosisLanguage = language === 'zh' ? 'zh-CN' : 'en'
  const t = labels[language]

  useEffect(() => {
    setSnapshot(undefined); setSelected(undefined); setError(undefined)
    if (!sessionId) return
    let live = true
    void getSnapshot(String(sessionId)).then((value) => { if (live) setSnapshot(value) }).catch((cause: unknown) => { if (live) setError(String(cause)) })
    const dispose = subscribe(String(sessionId), (value) => { if (live) setSnapshot(value) })
    return () => { live = false; dispose() }
  }, [sessionId])

  useEffect(() => {
    const keepInsideViewport = () => {
      setPosition((current) => {
        if (!current || !rootRef.current) return current
        const rect = rootRef.current.getBoundingClientRect()
        const next = clampHudPosition(current, rect, { width: window.innerWidth, height: window.innerHeight })
        storePosition(next)
        return next
      })
    }
    window.addEventListener('resize', keepInsideViewport)
    return () => window.removeEventListener('resize', keepInsideViewport)
  }, [])

  const selectedEvent = useMemo(() => [...(snapshot?.active ?? []), ...(snapshot?.resolved ?? [])].find((event) => event.fingerprint === selected), [snapshot, selected])
  const health = snapshot?.health ?? 'UNKNOWN'
  const run = async (key: string, work: () => Promise<unknown>) => { setBusy(key); setError(undefined); try { await work() } catch (cause) { setError(cause instanceof Error ? cause.message : t.unavailable) } finally { setBusy(undefined) } }

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, width: rect.width, height: rect.height }
    draggedRef.current = false
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }
  const continueDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (Math.abs(dx) + Math.abs(dy) > 3) draggedRef.current = true
    setPosition(clampHudPosition(
      { x: drag.originX + dx, y: drag.originY + dy },
      drag,
      { width: window.innerWidth, height: window.innerHeight },
    ))
  }
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = undefined
    setDragging(false)
    setPosition((current) => { storePosition(current); return current })
  }
  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || !rootRef.current) return
    const direction = event.key === 'ArrowLeft' ? { x: -12, y: 0 } : event.key === 'ArrowRight' ? { x: 12, y: 0 } : event.key === 'ArrowUp' ? { x: 0, y: -12 } : event.key === 'ArrowDown' ? { x: 0, y: 12 } : undefined
    if (!direction) return
    event.preventDefault()
    const rect = rootRef.current.getBoundingClientRect()
    const next = clampHudPosition({ x: rect.left + direction.x, y: rect.top + direction.y }, rect, { width: window.innerWidth, height: window.innerHeight })
    setPosition(next); storePosition(next)
  }
  const resetPosition = () => { setPosition(undefined); storePosition(undefined) }
  const panelOpensLeft = !position || position.x > window.innerWidth / 2

  return <div ref={rootRef} onPointerMove={continueDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} style={{ ...styles.root, ...(position ? { left: position.x, right: 'auto', top: position.y } : {}), ...(dragging ? styles.dragging : {}) }}>
    <button type="button" aria-label={`${t.title}: ${health}`} aria-expanded={open} title={t.dragHint} onPointerDown={beginDrag} onKeyDown={moveWithKeyboard} onClick={() => { if (draggedRef.current) { draggedRef.current = false; return } setOpen(!open) }} style={{ ...styles.badge, borderColor: healthColor(health), cursor: dragging ? 'grabbing' : 'grab' }}>
      <span aria-hidden="true" style={{ ...styles.dot, background: healthColor(health) }} /> {t.title} {snapshot?.active.length ? `(${snapshot.active.length})` : ''}
    </button>
    {open && <aside aria-label={t.title} style={{ ...styles.panel, ...(panelOpensLeft ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }) }}>
      <header onPointerDown={beginDrag} title={t.dragHint} style={{ ...styles.header, cursor: dragging ? 'grabbing' : 'grab' }}><div><strong><span aria-hidden="true" style={styles.grip}>⠿</span>{t.title}</strong><div role="status" style={styles.health}>{healthText(health, t)}</div></div><button type="button" aria-label={t.close} onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} style={styles.icon}>×</button></header>
      <p style={styles.mode}>{t.mode}</p>
      {!sessionId && <p style={styles.empty}>{t.unknown}</p>}
      {error && <div role="alert" style={styles.alert}>{error}</div>}
      {snapshot && <>
        <Section title={t.active} events={snapshot.active} empty={t.empty} selected={selected} language={language} onSelect={setSelected} />
        <Section title={t.resolved} events={snapshot.resolved} empty={t.empty} selected={selected} language={language} onSelect={setSelected} />
        {selectedEvent && <ErrorDetails event={selectedEvent} t={t} language={language} busy={busy === selectedEvent.fingerprint} onDiagnose={() => run(selectedEvent.fingerprint, async () => { await diagnose(snapshot.sessionId, selectedEvent.fingerprint, selectedEvent.version, diagnosisLanguage) })} onResolve={() => run(selectedEvent.fingerprint, () => resolveError(snapshot.sessionId, selectedEvent.fingerprint))} />}
        {snapshot.settings && <details style={styles.settings}><summary>{t.settings}</summary><dl style={styles.dl}><dt>{t.manualAi}</dt><dd>{snapshot.settings.enableAiAnalysis ? t.on : t.off}</dd><dt>{t.redaction}</dt><dd>{snapshot.settings.secretRedaction ? t.on : t.off}</dd><dt>{t.contextLimit}</dt><dd>{snapshot.settings.maxErrorContextLines} {t.lines}</dd><dt>{t.historyLimit}</dt><dd>{snapshot.settings.maxResolvedHistory} {t.cards}</dd></dl><button type="button" onClick={resetPosition} style={styles.secondary}>{t.resetPosition}</button></details>}
        <footer style={styles.footer}><button type="button" onClick={() => run('clear-resolved', () => clearResolved(snapshot.sessionId))} style={styles.secondary}>{t.clearResolved}</button><button type="button" onClick={() => run('clear', () => clearAll(snapshot.sessionId))} style={styles.danger}>{t.clear}</button></footer>
      </>}
    </aside>}
  </div>
}

function Section({ title, events, empty, selected, language, onSelect }: { title: string; events: ErrorEvent[]; empty: string; selected: string | undefined; language: keyof typeof labels; onSelect(value: string): void }) {
  return <section style={styles.section}><h2 style={styles.h2}>{title} <span style={styles.count}>{events.length}</span></h2>{events.length ? events.map((event) => <button type="button" key={event.fingerprint} onClick={() => onSelect(event.fingerprint)} aria-pressed={selected === event.fingerprint} style={{ ...styles.card, ...(selected === event.fingerprint ? styles.cardSelected : {}) }}><strong>{event.exceptionType}</strong><span style={styles.summary}>{eventSummary(event, language)}</span><small>{event.file ? `${event.file}${event.line ? `:${event.line}` : ''}` : categoryText(event.category, language)} · ×{event.occurrences}</small></button>) : <p style={styles.empty}>{empty}</p>}</section>
}

function ErrorDetails({ event, t, language, busy, onDiagnose, onResolve }: { event: ErrorEvent; t: typeof labels.en | typeof labels.zh; language: keyof typeof labels; busy: boolean; onDiagnose(): void; onResolve(): void }) {
  const copy = () => navigator.clipboard?.writeText(event.rawContext.join('\n'))
  const diagnosisMatches = Boolean(event.diagnosis && (event.diagnosis.locale === (language === 'zh' ? 'zh-CN' : 'en') || (!event.diagnosis.locale && language === 'en')))
  return <section style={styles.details}><h2 style={styles.h2}>{t.details}</h2><dl style={styles.dl}><dt>{t.category}</dt><dd>{categoryText(event.category, language)}</dd><dt>{t.capture}</dt><dd>{captureText(event.captureMode, language)}</dd><dt>{t.firstSeen}</dt><dd>{new Date(event.firstSeenAt).toLocaleString(language === 'zh' ? 'zh-CN' : undefined)}</dd>{event.command && <><dt>{t.command}</dt><dd><code>{event.command}</code></dd></>}</dl><details><summary>{t.context} ({event.rawContext.length})</summary><pre style={styles.pre}>{event.rawContext.join('\n')}</pre><button type="button" onClick={copy} style={styles.secondary}>{t.copy}</button></details>{event.diagnosis && diagnosisMatches && <div style={styles.diagnosis}><strong>{event.diagnosis.simpleExplanation}</strong>{event.diagnosis.likelyCauses.length > 0 && <><h3 style={styles.diagnosisHeading}>{t.likelyCauses}</h3><ul>{event.diagnosis.likelyCauses.map((value) => <li key={value}>{value}</li>)}</ul></>}{event.diagnosis.suggestedChecks.length > 0 && <><h3 style={styles.diagnosisHeading}>{t.suggestedChecks}</h3><ol>{event.diagnosis.suggestedChecks.map((value) => <li key={value}>{value}</li>)}</ol></>}<small>{t.confidence}：{confidenceText(event.diagnosis.confidence, language)}</small></div>}{event.diagnosis && !diagnosisMatches && <div role="status" style={styles.notice}>{t.oldDiagnosis}</div>}{event.diagnosisError && <div role="alert" style={styles.alert}>{event.diagnosisError}</div>}<div style={styles.actions}><button type="button" disabled={busy} onClick={onDiagnose} style={styles.primary}>{busy ? '…' : event.diagnosis && !diagnosisMatches ? t.regenerate : t.ai}</button>{event.status === 'active' && <button type="button" onClick={onResolve} style={styles.secondary}>{t.resolve}</button>}</div></section>
}

function eventSummary(event: ErrorEvent, language: keyof typeof labels): string {
  if (language !== 'zh') return event.summary
  if (event.category === 'MYBATIS') return 'MyBatis 找不到对应的 SQL 映射语句'
  if (event.category === 'APPLICATION_STARTUP') return event.port ? `应用启动失败：端口 ${event.port} 已被占用` : '应用启动失败'
  if (event.category === 'REDIS') return 'Redis 连接失败'
  if (event.category === 'DATABASE') return '数据库操作失败'
  if (event.category === 'SPRING_IOC') return 'Spring 组件创建或依赖注入失败'
  if (event.category === 'HTTP') return 'HTTP 请求处理失败'
  if (event.category === 'JAVA_RUNTIME' && /NullPointerException/.test(event.exceptionType)) return '程序访问了空对象'
  return event.summary
}

function categoryText(category: ErrorEvent['category'], language: keyof typeof labels): string {
  if (language !== 'zh') return category
  return ({ SPRING_IOC: 'Spring 依赖注入', MYBATIS: 'MyBatis', DATABASE: '数据库', REDIS: 'Redis', HTTP: 'HTTP 请求', JAVA_RUNTIME: 'Java 运行时', APPLICATION_STARTUP: '应用启动', UNKNOWN: '未分类' } as const)[category]
}

function captureText(mode: ErrorEvent['captureMode'], language: keyof typeof labels): string { return language === 'zh' ? mode === 'streaming-tool' ? '实时增量监控' : '命令结束后采集' : mode }
function confidenceText(confidence: 'high' | 'medium' | 'low', language: keyof typeof labels): string { return language === 'zh' ? ({ high: '高', medium: '中', low: '低' } as const)[confidence] : confidence }

function healthColor(health: SessionSnapshot['health']): string {
  return health === 'BROKEN'
    ? 'var(--dsw-alias-state-error-primary, #ef4444)'
    : health === 'HEALTHY'
      ? 'var(--dsw-alias-state-success-primary, #22c55e)'
      : 'var(--dsw-alias-label-tertiary, #94a3b8)'
}
function healthText(health: SessionSnapshot['health'], t: typeof labels.en | typeof labels.zh): string { return health === 'BROKEN' ? t.broken : health === 'HEALTHY' ? t.healthy : t.unknown }

const styles: Record<string, import('react').CSSProperties> = {
  root: { pointerEvents: 'auto', position: 'fixed', right: 16, top: 12, zIndex: 50, font: '13px/1.45 system-ui, sans-serif', color: 'var(--dsw-alias-label-primary, CanvasText)' },
  dragging: { userSelect: 'none' },
  badge: { border: '1px solid', borderRadius: 999, padding: '7px 11px', background: 'var(--dsw-alias-button-floating-fill, var(--dsw-alias-bg-layer-2, Canvas))', color: 'inherit', cursor: 'pointer', boxShadow: '0 4px 18px var(--dsw-alias-bg-mask-1, #0003)' },
  dot: { display: 'inline-block', width: 8, height: 8, borderRadius: 99, marginRight: 5 }, panel: { position: 'absolute', right: 0, top: 42, width: 'min(390px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 66px)', overflow: 'auto', border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-2, Canvas)', boxShadow: '0 18px 60px var(--dsw-alias-bg-mask-3, #0008)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: 14, borderBottom: '1px solid var(--dsw-alias-border-l2, #737373)', touchAction: 'none' }, grip: { display: 'inline-block', marginRight: 6, color: 'var(--dsw-alias-label-tertiary, GrayText)' }, health: { marginTop: 3, color: 'var(--dsw-alias-label-secondary, GrayText)' }, icon: { border: 0, background: 'transparent', color: 'inherit', fontSize: 24, cursor: 'pointer' }, mode: { margin: 12, padding: 10, borderRadius: 8, background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-3, Canvas))', color: 'var(--dsw-alias-label-secondary, GrayText)' }, alert: { margin: 12, padding: 10, borderRadius: 7, background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #ef4444) 14%, var(--dsw-alias-bg-layer-2, Canvas))', color: 'var(--dsw-alias-state-error-primary, #ef4444)' },
  section: { padding: '4px 12px 8px' }, h2: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 7px', color: 'var(--dsw-alias-label-secondary, GrayText)' }, count: { fontWeight: 400 }, card: { display: 'flex', width: '100%', flexDirection: 'column', gap: 4, textAlign: 'left', padding: 10, marginBottom: 7, border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-3, Canvas)', color: 'inherit', cursor: 'pointer' }, cardSelected: { borderColor: 'var(--dsw-alias-state-business-primary, #3b82f6)', boxShadow: '0 0 0 1px var(--dsw-alias-state-business-primary, #3b82f6)' }, summary: { color: 'var(--dsw-alias-label-secondary, GrayText)' }, empty: { color: 'var(--dsw-alias-label-tertiary, GrayText)', padding: '4px 12px' },
  details: { margin: 12, padding: 10, border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 8 }, dl: { display: 'grid', gridTemplateColumns: '90px 1fr', gap: 5, overflowWrap: 'anywhere' }, pre: { maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', padding: 8, borderRadius: 6, background: 'var(--dsw-alias-markdown-code-block, var(--dsw-alias-bg-module-platform, Canvas))', color: 'var(--dsw-alias-label-primary, CanvasText)', fontSize: 11 }, diagnosis: { marginTop: 10, padding: 10, background: 'var(--dsw-alias-state-success-tertiary, var(--dsw-alias-bg-layer-3, Canvas))', borderRadius: 7 }, diagnosisHeading: { margin: '12px 0 4px', fontSize: 12 }, notice: { marginTop: 10, padding: 10, borderRadius: 7, background: 'var(--dsw-alias-state-warn-tertiary, var(--dsw-alias-bg-layer-3, Canvas))', color: 'var(--dsw-alias-state-warn-label, CanvasText)' }, actions: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }, primary: { border: 0, borderRadius: 7, padding: '7px 10px', background: 'var(--dsw-alias-button-info-fill, #2563eb)', color: 'var(--dsw-static-neutral-00, white)', cursor: 'pointer' }, secondary: { border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 7, padding: '6px 9px', background: 'transparent', color: 'inherit', cursor: 'pointer' }, danger: { border: '1px solid var(--dsw-alias-state-error-primary, #ef4444)', borderRadius: 7, padding: '6px 9px', background: 'transparent', color: 'var(--dsw-alias-state-error-primary, #ef4444)', cursor: 'pointer' }, footer: { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: 12, borderTop: '1px solid var(--dsw-alias-border-l2, #737373)' },
  settings: { margin: 12, padding: 10, border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 8 },
}
