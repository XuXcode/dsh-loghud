import type { Diagnosis, DiagnosisLocale, ErrorEvent } from '../shared/types.js'
import { parseDiagnosis } from '../shared/validation.js'
import { redactLines, redactSecrets } from './redaction.js'

export interface DiagnosisClient { generate(prompt: string, signal?: AbortSignal): Promise<string> }

export class DiagnosisService {
  private readonly inflight = new Map<string, Promise<Diagnosis>>()
  calls = 0
  constructor(private readonly client: DiagnosisClient, private readonly redact = true) {}

  diagnose(event: ErrorEvent, signal?: AbortSignal, locale: DiagnosisLocale = 'en'): Promise<Diagnosis> {
    const key = `${event.fingerprint}:${event.version}:${locale}`
    const existing = this.inflight.get(key); if (existing) return existing
    this.calls++
    const request = this.client.generate(buildPrompt(event, this.redact, locale), signal).then(parseModelOutput).then((diagnosis) => ({ ...diagnosis, locale })).finally(() => this.inflight.delete(key))
    this.inflight.set(key, request); return request
  }
}

export function buildPrompt(event: ErrorEvent, redact: boolean, locale: DiagnosisLocale = 'en'): string {
  const context = redact ? redactLines(event.rawContext) : event.rawContext
  const data = {
    category: event.category, language: event.language, runtime: event.runtime, toolchain: event.toolchain,
    parserId: event.parserId, errorCode: event.errorCode, exceptionType: event.exceptionType,
    summary: redact ? redactSecrets(event.summary) : event.summary,
    rootMessage: event.rootMessage ? (redact ? redactSecrets(event.rootMessage) : event.rootMessage) : undefined,
    target: event.target, file: event.file, line: event.line, column: event.column, symbol: event.symbol,
    exceptionChain: event.exceptionChain, commandFamily: event.commandFamily,
    context: context.slice(-80),
  }
  const language = locale === 'zh-CN'
    ? 'All human-readable string values MUST use clear Simplified Chinese. Keep Java class names, method names, file paths, configuration keys, and code identifiers unchanged when needed. Do not include English translations.'
    : 'Write all human-readable string values in clear English.'
  return `You explain a local development runtime or build error to a developer. Be concise, beginner-friendly, and truthful. Do not repeat the stack trace. ${language} Return ONLY JSON with keys simpleExplanation (string), likelyCauses (string[]), suggestedChecks (string[]), confidence (high|medium|low).\n\nError:\n${JSON.stringify(data, null, 2)}`
}

function parseModelOutput(text: string): Diagnosis {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try { return parseDiagnosis(JSON.parse(candidate)) } catch {
    const plain = text.trim(); if (!plain) throw new Error('AI returned an empty response')
    return { simpleExplanation: plain.slice(0, 2000), likelyCauses: [], suggestedChecks: [], confidence: 'low' }
  }
}
