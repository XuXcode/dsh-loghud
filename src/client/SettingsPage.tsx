import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_SETTINGS, type LogHudSettings } from '../shared/types.js'

export interface LocaleSource {
  getSnapshot(): { active: string }
  subscribe(listener: () => void): () => void
}

export interface LogHudSettingsPageProps {
  scope: SettingsScope<LogHudSettings>
  locale: LocaleSource
}

type NumericSetting = 'maxErrorContextLines' | 'maxActiveErrors' | 'maxResolvedHistory' | 'maxIgnoredHistory'
type SaveState = { kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }

const numericSettings: ReadonlyArray<{ key: NumericSetting; min: number; max: number }> = [
  { key: 'maxErrorContextLines', min: 10, max: 1000 },
  { key: 'maxActiveErrors', min: 10, max: 500 },
  { key: 'maxResolvedHistory', min: 0, max: 500 },
  { key: 'maxIgnoredHistory', min: 0, max: 500 },
]

const booleanSettings = ['enabled', 'enableAiAnalysis', 'secretRedaction', 'beginnerFriendly'] as const
const allSettings = [...booleanSettings, ...numericSettings.map((item) => item.key)] as const

const copy = {
  en: {
    title: 'LogHUD settings', description: 'Configure local error monitoring. Changes apply immediately and are stored by Harness.',
    enabled: 'Enable LogHUD', enabledHelp: 'Show the HUD and collect new supported errors.',
    enableAiAnalysis: 'Manual AI explanations', enableAiAnalysisHelp: 'Allow AI analysis only after you click the explanation button.',
    secretRedaction: 'Secret redaction', secretRedactionHelp: 'Mask common credentials before any AI request.',
    beginnerFriendly: 'Beginner-friendly explanations', beginnerFriendlyHelp: 'Prefer plain-language AI explanations instead of concise technical wording.',
    maxErrorContextLines: 'Context lines per error', maxErrorContextLinesHelp: 'Applies to newly collected error blocks.',
    maxActiveErrors: 'Active errors per Session', maxActiveErrorsHelp: 'Older active cards are dropped when this bound is exceeded.',
    maxResolvedHistory: 'Resolved history per Session', maxResolvedHistoryHelp: 'Lowering this value prunes older resolved cards immediately.',
    maxIgnoredHistory: 'Ignored history per Session', maxIgnoredHistoryHelp: 'Lowering this value prunes older ignored cards immediately.',
    inherited: 'Inherited', overridden: 'Overridden', reset: 'Reset', resetAll: 'Reset all', saving: 'Saving…', saved: 'Saved',
    loading: 'Loading settings…', unavailable: 'Settings are unavailable in this browser. LogHUD continues with its Cordis configuration.',
    readOnly: 'Harness settings are read-only. LogHUD continues with the current values.', invalid: (min: number, max: number) => `Enter a whole number from ${min} to ${max}.`,
    saveFailed: 'Could not save this setting.', resetFailed: 'Could not restore the inherited value.',
  },
  zh: {
    title: 'LogHUD 设置', description: '配置本地错误监控。更改会立即生效，并由 Harness 持久化保存。',
    enabled: '启用 LogHUD', enabledHelp: '显示 HUD，并采集新的受支持错误。',
    enableAiAnalysis: '手动 AI 解释', enableAiAnalysisHelp: '只有点击解释按钮后才允许调用 AI。',
    secretRedaction: '敏感信息遮盖', secretRedactionHelp: '发送任何 AI 请求前，遮盖常见凭据和密钥。',
    beginnerFriendly: '初学者友好解释', beginnerFriendlyHelp: '优先生成通俗说明；关闭后使用更精炼的技术表达。',
    maxErrorContextLines: '每个错误的上下文行数', maxErrorContextLinesHelp: '仅影响之后采集的新错误块。',
    maxActiveErrors: '每个会话的活动错误上限', maxActiveErrorsHelp: '超过上限时丢弃较旧的活动错误卡片。',
    maxResolvedHistory: '每个会话的已解决历史上限', maxResolvedHistoryHelp: '降低数值会立即裁剪较旧的已解决卡片。',
    maxIgnoredHistory: '每个会话的已忽略历史上限', maxIgnoredHistoryHelp: '降低数值会立即裁剪较旧的已忽略卡片。',
    inherited: '继承默认值', overridden: '用户已覆盖', reset: '恢复默认', resetAll: '全部恢复默认', saving: '正在保存…', saved: '已保存',
    loading: '正在加载设置…', unavailable: '当前浏览器无法使用设置服务。LogHUD 将继续使用 Cordis 配置。',
    readOnly: 'Harness 设置当前为只读，LogHUD 将继续使用现有值。', invalid: (min: number, max: number) => `请输入 ${min} 到 ${max} 之间的整数。`,
    saveFailed: '无法保存此设置。', resetFailed: '无法恢复继承值。',
  },
} as const

export function LogHudSettingsPage({ scope, locale }: LogHudSettingsPageProps) {
  const snapshot = useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot())
  const localeSnapshot = useSyncExternalStore((listener) => locale.subscribe(listener), () => locale.getSnapshot(), () => locale.getSnapshot())
  const language = localeSnapshot.active.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  const t = copy[language]
  const value = snapshot.value ?? DEFAULT_SETTINGS
  const [drafts, setDrafts] = useState<Record<NumericSetting, string>>(() => numericDrafts(value))
  const [saveStates, setSaveStates] = useState<Partial<Record<keyof LogHudSettings | 'all', SaveState>>>({})
  const disabled = snapshot.status !== 'ready' || !snapshot.writable
  const user = useMemo(() => isRecord(snapshot.user) ? snapshot.user : {}, [snapshot.user])

  useEffect(() => { setDrafts(numericDrafts(value)) }, [value.maxErrorContextLines, value.maxActiveErrors, value.maxResolvedHistory, value.maxIgnoredHistory])

  const setState = (field: keyof LogHudSettings | 'all', state: SaveState) => setSaveStates((current) => ({ ...current, [field]: state }))
  const save = async (field: keyof LogHudSettings, next: unknown) => {
    setState(field, { kind: 'saving' })
    try { await scope.set(field, next); setState(field, { kind: 'saved' }) }
    catch (error) { setState(field, { kind: 'error', message: error instanceof Error ? error.message : t.saveFailed }) }
  }
  const reset = async (field: keyof LogHudSettings) => {
    setState(field, { kind: 'saving' })
    try { await scope.unset(field); setState(field, { kind: 'saved' }) }
    catch (error) { setState(field, { kind: 'error', message: error instanceof Error ? error.message : t.resetFailed }) }
  }
  const resetAll = async () => {
    setState('all', { kind: 'saving' })
    try { for (const field of allSettings) await scope.unset(field); setState('all', { kind: 'saved' }) }
    catch (error) { setState('all', { kind: 'error', message: error instanceof Error ? error.message : t.resetFailed }) }
  }
  const saveNumber = (setting: typeof numericSettings[number]) => {
    const parsed = Number(drafts[setting.key])
    if (!Number.isInteger(parsed) || parsed < setting.min || parsed > setting.max) {
      setState(setting.key, { kind: 'error', message: t.invalid(setting.min, setting.max) }); return
    }
    if (parsed !== value[setting.key]) void save(setting.key, parsed)
  }
  const numberKeyDown = (event: KeyboardEvent<HTMLInputElement>, setting: typeof numericSettings[number]) => {
    if (event.key === 'Enter') { event.preventDefault(); saveNumber(setting); event.currentTarget.blur() }
  }

  if (snapshot.status === 'loading') return <section aria-busy="true" style={styles.page}><p role="status">{t.loading}</p></section>

  return <section aria-labelledby="loghud-settings-title" style={styles.page}>
    <header style={styles.heading}><div><h2 id="loghud-settings-title" style={styles.title}>{t.title}</h2><p style={styles.description}>{t.description}</p></div><button type="button" disabled={disabled} onClick={() => void resetAll()} style={styles.button}>{t.resetAll}</button></header>
    {snapshot.status === 'unavailable' && <p role="status" style={styles.notice}>{t.unavailable}</p>}
    {snapshot.status === 'ready' && !snapshot.writable && <p role="status" style={styles.notice}>{t.readOnly}</p>}
    <fieldset disabled={disabled} style={styles.fieldset}>
      <legend style={styles.srOnly}>{t.title}</legend>
      {booleanSettings.map((field) => <div key={field} style={styles.row}>
        <div style={styles.labelBlock}><label htmlFor={`loghud-${field}`} style={styles.label}>{t[field]}</label><span id={`loghud-${field}-help`} style={styles.help}>{t[`${field}Help` as keyof typeof t] as string}</span><OverrideState overridden={Object.hasOwn(user, field)} language={language} /></div>
        <div style={styles.controls}><input id={`loghud-${field}`} type="checkbox" role="switch" checked={value[field]} aria-describedby={`loghud-${field}-help`} onChange={(event) => void save(field, event.target.checked)} style={styles.switch} /><ResetButton field={field} overridden={Object.hasOwn(user, field)} state={saveStates[field]} label={t.reset} onReset={reset} /></div>
        <SaveMessage state={saveStates[field]} saving={t.saving} saved={t.saved} />
      </div>)}
      {numericSettings.map((setting) => { const state = saveStates[setting.key]; const invalid = state?.kind === 'error' && state.message === t.invalid(setting.min, setting.max); return <div key={setting.key} style={styles.row}>
        <div style={styles.labelBlock}><label htmlFor={`loghud-${setting.key}`} style={styles.label}>{t[setting.key]}</label><span id={`loghud-${setting.key}-help`} style={styles.help}>{t[`${setting.key}Help` as keyof typeof t] as string}</span><OverrideState overridden={Object.hasOwn(user, setting.key)} language={language} /></div>
        <div style={styles.controls}><input id={`loghud-${setting.key}`} type="number" min={setting.min} max={setting.max} step={1} value={drafts[setting.key]} aria-invalid={invalid || undefined} aria-describedby={`loghud-${setting.key}-help${state?.kind === 'error' ? ` loghud-${setting.key}-status` : ''}`} onChange={(event) => setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))} onBlur={() => saveNumber(setting)} onKeyDown={(event) => numberKeyDown(event, setting)} style={styles.number} /><ResetButton field={setting.key} overridden={Object.hasOwn(user, setting.key)} state={state} label={t.reset} onReset={reset} /></div>
        <SaveMessage id={`loghud-${setting.key}-status`} state={state} saving={t.saving} saved={t.saved} />
      </div> })}
    </fieldset>
    <SaveMessage state={saveStates.all} saving={t.saving} saved={t.saved} />
  </section>
}

function ResetButton({ field, overridden, state, label, onReset }: { field: keyof LogHudSettings; overridden: boolean; state?: SaveState | undefined; label: string; onReset(field: keyof LogHudSettings): Promise<void> }) {
  return <button type="button" disabled={!overridden || state?.kind === 'saving'} onClick={() => void onReset(field)} style={styles.button}>{label}</button>
}

function OverrideState({ overridden, language }: { overridden: boolean; language: 'en' | 'zh' }) { return <small style={styles.meta}>{overridden ? copy[language].overridden : copy[language].inherited}</small> }

function SaveMessage({ id, state, saving, saved }: { id?: string | undefined; state?: SaveState | undefined; saving: string; saved: string }) {
  const message = state?.kind === 'saving' ? saving : state?.kind === 'saved' ? saved : state?.kind === 'error' ? state.message : undefined
  return <span id={id} aria-live="polite" role={state?.kind === 'error' ? 'alert' : 'status'} style={{ ...styles.status, ...(state?.kind === 'error' ? styles.error : {}) }}>{message}</span>
}

function numericDrafts(value: LogHudSettings): Record<NumericSetting, string> {
  return { maxErrorContextLines: String(value.maxErrorContextLines), maxActiveErrors: String(value.maxActiveErrors), maxResolvedHistory: String(value.maxResolvedHistory), maxIgnoredHistory: String(value.maxIgnoredHistory) }
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 760, padding: '8px 4px 32px', color: 'var(--dsw-alias-label-primary, CanvasText)' },
  heading: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, paddingBottom: 18, borderBottom: '1px solid var(--dsw-alias-border-l2, #737373)' },
  title: { margin: 0, fontSize: 22, lineHeight: 1.25 }, description: { margin: '7px 0 0', color: 'var(--dsw-alias-label-secondary, GrayText)' },
  notice: { padding: 12, border: '1px solid var(--dsw-alias-state-warn-primary, #b7791f)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2, Canvas)' },
  fieldset: { margin: 0, padding: 0, border: 0 }, row: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px 20px', padding: '18px 0', borderBottom: '1px solid var(--dsw-alias-border-l2, #737373)' },
  labelBlock: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4 }, label: { fontWeight: 650 }, help: { color: 'var(--dsw-alias-label-secondary, GrayText)', lineHeight: 1.45 }, meta: { color: 'var(--dsw-alias-label-tertiary, GrayText)' },
  controls: { display: 'flex', alignItems: 'center', gap: 8 }, switch: { width: 38, height: 20, accentColor: 'var(--dsw-alias-state-business-primary, #2563eb)' }, number: { width: 104, boxSizing: 'border-box', padding: '7px 9px', border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 7, background: 'var(--dsw-alias-bg-layer-1, Canvas)', color: 'inherit' },
  button: { minHeight: 34, padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l2, #737373)', borderRadius: 7, background: 'var(--dsw-alias-bg-layer-2, transparent)', color: 'inherit', cursor: 'pointer' },
  status: { minHeight: 18, gridColumn: '1 / -1', color: 'var(--dsw-alias-state-success-primary, #15803d)' }, error: { color: 'var(--dsw-alias-state-error-primary, #dc2626)' },
  srOnly: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 },
}
