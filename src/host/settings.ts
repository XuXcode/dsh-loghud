import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'
import type { ErrorStore } from '../core/store.js'
import type { LogHudSettings } from '../shared/types.js'
import { normalizeLogHudSettings } from '../shared/validation.js'

export const LOGHUD_SETTINGS_NAMESPACE = settingsNamespace('dsh-loghud')

export const LogHudSettingsSchema = Schema.object({
  enabled: Schema.boolean().default(true).description('Enable LogHUD error monitoring and the HUD overlay.'),
  enableAiAnalysis: Schema.boolean().default(true).description('Allow manual, opt-in AI explanations.'),
  maxErrorContextLines: Schema.number().min(10).max(1000).step(1).default(120).description('Maximum context lines retained for each error.'),
  maxActiveErrors: Schema.number().min(10).max(500).step(1).default(100).description('Maximum active error cards retained per Session.'),
  maxResolvedHistory: Schema.number().min(0).max(500).step(1).default(50).description('Maximum resolved error cards retained per Session.'),
  maxIgnoredHistory: Schema.number().min(0).max(500).step(1).default(50).description('Maximum ignored error cards retained per Session.'),
  secretRedaction: Schema.boolean().default(true).description('Redact common secrets before sending context to AI.'),
  beginnerFriendly: Schema.boolean().default(true).description('Use beginner-friendly wording in AI explanations.'),
}) as Schema<LogHudSettings>

export function installLogHudSettings(ctx: Context, store: ErrorStore, entry: Partial<LogHudSettings>): void {
  const base = normalizeLogHudSettings(entry)
  let current = (): LogHudSettings => base
  installSettingsSection(ctx, LOGHUD_SETTINGS_NAMESPACE, LogHudSettingsSchema, base, {
    setSource(source) { current = source },
    onChange() { store.updateSettings(current()) },
  })
}
