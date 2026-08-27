import { DEFAULT_SETTINGS, type Confidence, type Diagnosis, type DiagnosisLocale, type LogHudSettings } from './types.js'

const confidence = new Set<Confidence>(['high', 'medium', 'low'])

export function parseDiagnosis(value: unknown): Diagnosis {
  if (!value || typeof value !== 'object') throw new Error('Diagnosis must be an object')
  const input = value as Record<string, unknown>
  if (typeof input.simpleExplanation !== 'string' || !input.simpleExplanation.trim()) {
    throw new Error('Diagnosis is missing simpleExplanation')
  }
  const causes = stringArray(input.likelyCauses)
  const checks = stringArray(input.suggestedChecks)
  const level = typeof input.confidence === 'string' && confidence.has(input.confidence as Confidence)
    ? input.confidence as Confidence : 'low'
  const locale = input.locale === 'zh-CN' || input.locale === 'en' ? input.locale as DiagnosisLocale : undefined
  return { simpleExplanation: input.simpleExplanation.trim(), likelyCauses: causes, suggestedChecks: checks, confidence: level, ...(locale ? { locale } : {}) }
}

export function normalizeLogHudSettings(input: Partial<LogHudSettings> = {}): LogHudSettings {
  return {
    enabled: booleanValue(input.enabled, DEFAULT_SETTINGS.enabled),
    enableAiAnalysis: booleanValue(input.enableAiAnalysis, DEFAULT_SETTINGS.enableAiAnalysis),
    maxErrorContextLines: finiteInteger(input.maxErrorContextLines, DEFAULT_SETTINGS.maxErrorContextLines, 10, 1000),
    maxActiveErrors: finiteInteger(input.maxActiveErrors, DEFAULT_SETTINGS.maxActiveErrors, 10, 500),
    maxResolvedHistory: finiteInteger(input.maxResolvedHistory, DEFAULT_SETTINGS.maxResolvedHistory, 0, 500),
    maxIgnoredHistory: finiteInteger(input.maxIgnoredHistory, DEFAULT_SETTINGS.maxIgnoredHistory, 0, 500),
    secretRedaction: booleanValue(input.secretRedaction, DEFAULT_SETTINGS.secretRedaction),
    beginnerFriendly: booleanValue(input.beginnerFriendly, DEFAULT_SETTINGS.beginnerFriendly),
  }
}

export function decodeLogHudSettings(value: unknown): LogHudSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<keyof LogHudSettings, unknown>
  if (typeof input.enabled !== 'boolean' || typeof input.enableAiAnalysis !== 'boolean'
    || typeof input.secretRedaction !== 'boolean' || typeof input.beginnerFriendly !== 'boolean') return undefined
  if (!validInteger(input.maxErrorContextLines, 10, 1000) || !validInteger(input.maxActiveErrors, 10, 500)
    || !validInteger(input.maxResolvedHistory, 0, 500) || !validInteger(input.maxIgnoredHistory, 0, 500)) return undefined
  return input as unknown as LogHudSettings
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 8) : []
}

function booleanValue(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback }

function finiteInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback
}

function validInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}
