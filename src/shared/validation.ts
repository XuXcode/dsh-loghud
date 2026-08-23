import type { Confidence, Diagnosis, DiagnosisLocale } from './types.js'

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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 8) : []
}
