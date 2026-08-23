export type ErrorCategory =
  | 'SPRING_IOC' | 'MYBATIS' | 'DATABASE' | 'REDIS' | 'HTTP'
  | 'JAVA_RUNTIME' | 'APPLICATION_STARTUP' | 'UNKNOWN'

export type ProjectHealth = 'HEALTHY' | 'BROKEN' | 'UNKNOWN'
export type ErrorStatus = 'active' | 'resolved'
export type CaptureMode = 'tool-result' | 'streaming-tool'
export type Confidence = 'high' | 'medium' | 'low'
export type DiagnosisLocale = 'en' | 'zh-CN'

export interface ErrorEvent {
  id: string
  fingerprint: string
  version: number
  status: ErrorStatus
  severity: 'error' | 'warning'
  framework?: string | undefined
  category: ErrorCategory
  exceptionType: string
  summary: string
  rootMessage?: string | undefined
  target?: string | undefined
  file?: string | undefined
  line?: number | undefined
  symbol?: string | undefined
  port?: number | undefined
  command?: string | undefined
  commandFamily?: string | undefined
  captureMode: CaptureMode
  firstSeenAt: number
  lastSeenAt: number
  resolvedAt?: number | undefined
  occurrences: number
  exceptionChain: string[]
  rawContext: string[]
  diagnosis?: Diagnosis | undefined
  diagnosisError?: string | undefined
}

export interface Diagnosis {
  simpleExplanation: string
  likelyCauses: string[]
  suggestedChecks: string[]
  confidence: Confidence
  locale?: DiagnosisLocale | undefined
}

export interface ErrorDetectionRule {
  id: string
  framework?: string | undefined
  startPatterns: RegExp[]
  category: ErrorCategory
  severity: 'error' | 'warning'
}

export interface LogHudSettings {
  enabled: boolean
  enableAiAnalysis: boolean
  maxErrorContextLines: number
  maxResolvedHistory: number
  secretRedaction: boolean
  beginnerFriendly: boolean
}

export interface SessionSnapshot {
  sessionId: string
  health: ProjectHealth
  observedCommand: boolean
  active: ErrorEvent[]
  resolved: ErrorEvent[]
  revision: number
  settings?: LogHudSettings | undefined
}

export type LogHudSseMessage =
  | { type: 'snapshot'; data: SessionSnapshot }
  | { type: 'heartbeat'; time: number }
  | { type: 'error'; message: string }

export interface ParsedError {
  category: ErrorCategory
  framework?: string
  exceptionType: string
  summary: string
  rootMessage?: string
  target?: string
  file?: string
  line?: number
  symbol?: string
  port?: number
  exceptionChain: string[]
  rawContext: string[]
}

export const DEFAULT_SETTINGS: LogHudSettings = {
  enabled: true,
  enableAiAnalysis: true,
  maxErrorContextLines: 120,
  maxResolvedHistory: 50,
  secretRedaction: true,
  beginnerFriendly: true,
}
