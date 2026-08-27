export type ErrorCategory =
  | 'SPRING_IOC' | 'MYBATIS' | 'DATABASE' | 'REDIS' | 'HTTP'
  | 'JAVA_RUNTIME' | 'APPLICATION_STARTUP' | 'NODE_RUNTIME'
  | 'TYPESCRIPT_COMPILE' | 'MODULE_RESOLUTION' | 'BUILD_FAILURE'
  | 'PYTHON_RUNTIME' | 'PYTHON_IMPORT' | 'PYTHON_TEST_FAILURE' | 'UNKNOWN'

export type ProjectHealth = 'HEALTHY' | 'BROKEN' | 'UNKNOWN'
export type ErrorStatus = 'active' | 'resolved' | 'ignored'
export type CaptureMode = 'tool-result' | 'streaming-tool'
export type Confidence = 'high' | 'medium' | 'low'
export type DiagnosisLocale = 'en' | 'zh-CN'
export type RuntimeLanguage = 'java' | 'javascript' | 'typescript' | 'python' | 'unknown'
export type RuntimeName = 'jvm' | 'node' | 'python' | 'unknown'
export type Toolchain = 'maven' | 'gradle' | 'java' | 'node' | 'npm' | 'pnpm' | 'yarn' | 'typescript' | 'vite' | 'rollup' | 'webpack' | 'next' | 'vitest' | 'jest' | 'python' | 'pip' | 'pytest' | 'uv' | 'poetry' | 'pipenv' | 'unknown'
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface ErrorEvent {
  id: string
  fingerprint: string
  version: number
  status: ErrorStatus
  severity: 'error' | 'warning'
  framework?: string | undefined
  language?: RuntimeLanguage | undefined
  runtime?: RuntimeName | undefined
  toolchain?: Toolchain | undefined
  parserId?: string | undefined
  category: ErrorCategory
  exceptionType: string
  errorCode?: string | undefined
  summary: string
  rootMessage?: string | undefined
  target?: string | undefined
  file?: string | undefined
  line?: number | undefined
  column?: number | undefined
  symbol?: string | undefined
  port?: number | undefined
  command?: string | undefined
  commandFamily?: string | undefined
  captureMode: CaptureMode
  firstSeenAt: number
  lastSeenAt: number
  resolvedAt?: number | undefined
  ignoredAt?: number | undefined
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
  language?: RuntimeLanguage | undefined
  toolchain?: Toolchain | undefined
  startPatterns: RegExp[]
  category: ErrorCategory
  severity: 'error' | 'warning'
}

export interface LogHudSettings {
  enabled: boolean
  enableAiAnalysis: boolean
  maxErrorContextLines: number
  maxActiveErrors: number
  maxResolvedHistory: number
  maxIgnoredHistory: number
  secretRedaction: boolean
  beginnerFriendly: boolean
}

export interface SessionSnapshot {
  schemaVersion: 3
  sessionId: string
  health: ProjectHealth
  observedCommand: boolean
  active: ErrorEvent[]
  resolved: ErrorEvent[]
  ignored: ErrorEvent[]
  droppedActiveErrors: number
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
  language?: RuntimeLanguage
  runtime?: RuntimeName
  toolchain?: Toolchain
  parserId?: string
  exceptionType: string
  errorCode?: string
  summary: string
  rootMessage?: string
  target?: string
  file?: string
  line?: number
  column?: number
  symbol?: string
  port?: number
  exceptionChain: string[]
  rawContext: string[]
}

export const DEFAULT_SETTINGS: LogHudSettings = {
  enabled: true,
  enableAiAnalysis: true,
  maxErrorContextLines: 120,
  maxActiveErrors: 100,
  maxResolvedHistory: 50,
  maxIgnoredHistory: 50,
  secretRedaction: true,
  beginnerFriendly: true,
}
