import { describe, expect, it } from 'vitest'
import { ErrorStore } from '../src/core/store.js'
import { buildPrompt } from '../src/core/diagnosis.js'
import { LogHudSettingsSchema } from '../src/host/settings.js'
import { migrateSessionSnapshot } from '../src/host/persistence.js'
import { DEFAULT_SETTINGS, type ErrorEvent, type ParsedError } from '../src/shared/types.js'

const parsed = (index: number): ParsedError => ({ category: 'PYTHON_RUNTIME', language: 'python', runtime: 'python', toolchain: 'python', exceptionType: 'ValueError', summary: `failure ${index}`, rootMessage: `failure ${index}`, file: `app/file-${index}.py`, line: index + 1, exceptionChain: ['ValueError'], rawContext: [`ValueError: failure ${index}`] })

describe('v0.3 settings behavior', () => {
  it('applies defaults and rejects values outside the public settings schema', () => {
    expect(new LogHudSettingsSchema()).toMatchObject({ enabled: true, maxActiveErrors: 100, maxErrorContextLines: 120 })
    expect(() => LogHudSettingsSchema({ ...DEFAULT_SETTINGS, maxActiveErrors: 9 })).toThrow()
    expect(() => LogHudSettingsSchema({ ...DEFAULT_SETTINGS, maxErrorContextLines: 1001 })).toThrow()
  })

  it('prunes active cards immediately when a live setting lowers the bound', () => {
    const store = new ErrorStore({ maxActiveErrors: 20 })
    for (let index = 0; index < 15; index++) store.observe('s', parsed(index), { captureMode: 'tool-result', now: index + 1 })
    store.updateSettings({ ...store.settings, maxActiveErrors: 10 })
    expect(store.snapshot('s').active).toHaveLength(10)
    expect(store.snapshot('s').droppedActiveErrors).toBe(5)
  })

  it('keeps settings live while preserving existing cards when disabled', () => {
    const store = new ErrorStore(); store.observe('s', parsed(1), { captureMode: 'tool-result' })
    store.updateSettings({ ...store.settings, enabled: false })
    expect(store.snapshot('s').active).toHaveLength(1)
    expect(store.snapshot('s').settings?.enabled).toBe(false)
  })

  it('migrates v0.1 and v0.2 snapshots to schema version 3', () => {
    const event = storeEvent()
    const v1 = migrateSessionSnapshot({ sessionId: 'old-1', health: 'BROKEN', observedCommand: true, active: [event], resolved: [], revision: 4 })
    const v2 = migrateSessionSnapshot({ schemaVersion: 2, sessionId: 'old-2', health: 'HEALTHY', observedCommand: true, active: [], resolved: [], ignored: [], revision: 5 })
    expect(v1).toMatchObject({ schemaVersion: 3, ignored: [], droppedActiveErrors: 0 })
    expect(v2).toMatchObject({ schemaVersion: 3, droppedActiveErrors: 0 })
  })

  it('switches the AI prompt between beginner and technical wording', () => {
    const event = { ...storeEvent(), language: 'python' as const, runtime: 'python' as const, toolchain: 'pytest' as const }
    expect(buildPrompt(event, true, 'en', true)).toContain('plain language suitable for a beginner')
    expect(buildPrompt(event, true, 'en', false)).toContain('concise technical language')
  })
})

function storeEvent(): ErrorEvent {
  return { id: 'id', fingerprint: 'fingerprint', version: 1, status: 'active', severity: 'error', category: 'PYTHON_TEST_FAILURE', exceptionType: 'AssertionError', summary: 'failed', captureMode: 'tool-result', firstSeenAt: 1, lastSeenAt: 1, occurrences: 1, exceptionChain: ['AssertionError'], rawContext: ['AssertionError: failed'] }
}
