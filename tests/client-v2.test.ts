// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { subscribe } from '../src/client/api.js'
import { filterEvents, clampHudSize } from '../src/client/LogHud.js'
import { snapshotMarkdown } from '../src/client/export.js'
import type { ErrorEvent, SessionSnapshot } from '../src/shared/types.js'

const nodeError: ErrorEvent = { id: 'n', fingerprint: 'node', version: 1, status: 'active', severity: 'error', category: 'NODE_RUNTIME', language: 'javascript', runtime: 'node', toolchain: 'node', parserId: 'node', exceptionType: 'TypeError', summary: 'user is null', file: 'src/app.js', line: 2, column: 4, captureMode: 'tool-result', firstSeenAt: 1, lastSeenAt: 1, occurrences: 1, exceptionChain: ['TypeError'], rawContext: ['TypeError: user is null'] }
const javaError: ErrorEvent = { ...nodeError, id: 'j', fingerprint: 'java', category: 'JAVA_RUNTIME', language: 'java', runtime: 'jvm', toolchain: 'java', exceptionType: 'NullPointerException', summary: 'order missing', file: 'Order.java', column: undefined }
const snapshot: SessionSnapshot = { schemaVersion: 3, sessionId: 's', health: 'BROKEN', observedCommand: true, active: [nodeError, javaError], resolved: [], ignored: [], droppedActiveErrors: 0, revision: 3 }

describe('v0.2 client utilities', () => {
  it('filters by text, language, and category', () => {
    expect(filterEvents(snapshot.active, 'user', '', '')).toEqual([nodeError])
    expect(filterEvents(snapshot.active, '', 'java', '')).toEqual([javaError])
    expect(filterEvents(snapshot.active, '', '', 'NODE_RUNTIME')).toEqual([nodeError])
  })

  it('clamps persisted panel dimensions', () => {
    expect(clampHudSize({ width: 100, height: 100 }, { width: 1200, height: 900 })).toEqual({ width: 320, height: 360 })
    expect(clampHudSize({ width: 2000, height: 2000 }, { width: 1000, height: 700 })).toEqual({ width: 984, height: 642 })
  })

  it('exports all three lifecycle lists as Markdown', () => {
    expect(snapshotMarkdown({ ...snapshot, ignored: [{ ...nodeError, status: 'ignored' }] })).toContain('## Ignored (1)')
    expect(snapshotMarkdown(snapshot)).toContain('src/app.js:2:4')
  })

  it('reports EventSource connection and reconnection states', () => {
    class Source {
      static current: Source
      onopen: (() => void) | null = null; onerror: (() => void) | null = null
      listeners = new Map<string, (event: MessageEvent<string>) => void>()
      constructor() { Source.current = this }
      addEventListener(name: string, listener: EventListenerOrEventListenerObject) { this.listeners.set(name, listener as (event: MessageEvent<string>) => void) }
      close() {}
    }
    vi.stubGlobal('EventSource', Source)
    const states: string[] = []; const dispose = subscribe('s', () => undefined, (state) => states.push(state))
    Source.current.onopen?.(); Source.current.onerror?.(); Source.current.listeners.get('heartbeat')?.(new MessageEvent('heartbeat'))
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])
    dispose(); expect(states.at(-1)).toBe('offline')
    vi.unstubAllGlobals()
  })
})
