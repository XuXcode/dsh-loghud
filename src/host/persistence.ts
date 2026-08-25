import { defineDomain, domainTable, type DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import type { ErrorStore } from '../core/store.js'
import { DEFAULT_SETTINGS, type LogHudSettings, type SessionSnapshot } from '../shared/types.js'

const settingsSchema = z.object({
  enabled: z.boolean(), enableAiAnalysis: z.boolean(), maxErrorContextLines: z.number().int().min(10).max(1000),
  maxResolvedHistory: z.number().int().min(0).max(500), maxIgnoredHistory: z.number().int().min(0).max(500).default(50),
  secretRedaction: z.boolean(), beginnerFriendly: z.boolean(),
})
const categorySchema = z.enum(['SPRING_IOC', 'MYBATIS', 'DATABASE', 'REDIS', 'HTTP', 'JAVA_RUNTIME', 'NODE_RUNTIME', 'TYPESCRIPT_COMPILE', 'MODULE_RESOLUTION', 'BUILD_FAILURE', 'APPLICATION_STARTUP', 'UNKNOWN'])
const eventSchema = z.object({
  id: z.string(), fingerprint: z.string(), version: z.number().int(), status: z.enum(['active', 'resolved', 'ignored']), severity: z.enum(['error', 'warning']),
  framework: z.string().optional(), language: z.enum(['java', 'javascript', 'typescript', 'unknown']).optional(), runtime: z.enum(['jvm', 'node', 'unknown']).optional(),
  toolchain: z.enum(['java', 'maven', 'gradle', 'node', 'npm', 'pnpm', 'yarn', 'typescript', 'vite', 'rollup', 'webpack', 'next', 'vitest', 'jest', 'unknown']).optional(),
  parserId: z.string().optional(), errorCode: z.string().optional(), category: categorySchema,
  exceptionType: z.string(), summary: z.string(), rootMessage: z.string().optional(), target: z.string().optional(), file: z.string().optional(), line: z.number().int().optional(), column: z.number().int().optional(),
  symbol: z.string().optional(), port: z.number().int().optional(), command: z.string().optional(), commandFamily: z.string().optional(), captureMode: z.enum(['tool-result', 'streaming-tool']),
  firstSeenAt: z.number(), lastSeenAt: z.number(), resolvedAt: z.number().optional(), ignoredAt: z.number().optional(), occurrences: z.number().int(), exceptionChain: z.array(z.string()), rawContext: z.array(z.string()),
  diagnosis: z.object({ simpleExplanation: z.string(), likelyCauses: z.array(z.string()), suggestedChecks: z.array(z.string()), confidence: z.enum(['high', 'medium', 'low']), locale: z.enum(['en', 'zh-CN']).optional() }).optional(),
  diagnosisError: z.string().optional(),
})
const snapshotSchema: z.ZodType<SessionSnapshot> = z.object({
  schemaVersion: z.literal(2).default(2), sessionId: z.string(), health: z.enum(['HEALTHY', 'BROKEN', 'UNKNOWN']), observedCommand: z.boolean(),
  active: z.array(eventSchema), resolved: z.array(eventSchema), ignored: z.array(eventSchema).default([]), revision: z.number().int(),
})

const LOGHUD_DOMAIN = defineDomain({
  name: 'dsh_loghud', version: 1,
  global: { schema: z.object({ initialized: z.boolean(), settings: settingsSchema }), initial: { initialized: false, settings: DEFAULT_SETTINGS } },
  tables: { sessions: domainTable<string, SessionSnapshot>(snapshotSchema) },
})

export async function openPersistence(facility: DomainFacility, store: ErrorStore): Promise<() => Promise<void>> {
  const domain = await facility.open(LOGHUD_DOMAIN)
  const persisted = domain.global.get()
  if (persisted.initialized) Object.assign(store.settings, DEFAULT_SETTINGS, persisted.settings)
  else await domain.global.set({ initialized: true, settings: { ...store.settings } as LogHudSettings })
  const sessions = domain.table('sessions')
  for (const [, snapshot] of sessions.entries()) store.restore(snapshot)
  const dispose = store.subscribeAll((snapshot) => { void sessions.put(snapshot.sessionId, snapshot).catch(() => undefined) })
  return async () => { dispose(); await domain.close() }
}
