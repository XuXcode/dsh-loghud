import { randomUUID } from 'node:crypto'
import type { CaptureMode, Diagnosis, ErrorEvent, ParsedError, SessionSnapshot } from '../shared/types.js'
import type { LogHudSettings } from '../shared/types.js'
import { normalizeLogHudSettings } from '../shared/validation.js'
import { createFingerprint } from './fingerprint.js'

interface SessionState { observedCommand: boolean; revision: number; droppedActiveErrors: number; errors: Map<string, ErrorEvent> }
type Listener = (snapshot: SessionSnapshot) => void

export class ErrorStore {
  private readonly sessions = new Map<string, SessionState>()
  private readonly listeners = new Map<string, Set<Listener>>()
  private readonly allListeners = new Set<Listener>()
  readonly settings: LogHudSettings

  constructor(settings: Partial<LogHudSettings> = {}) {
    this.settings = normalizeLogHudSettings(settings)
  }

  updateSettings(settings: Partial<LogHudSettings>): LogHudSettings {
    const next = normalizeLogHudSettings(settings)
    const changed = Object.keys(next).some((key) => this.settings[key as keyof LogHudSettings] !== next[key as keyof LogHudSettings])
    if (!changed) return { ...this.settings }
    Object.assign(this.settings, next)
    for (const [sessionId, state] of this.sessions) {
      for (const [fingerprint, event] of state.errors) {
        if (event.rawContext.length > next.maxErrorContextLines) state.errors.set(fingerprint, { ...event, rawContext: event.rawContext.slice(-next.maxErrorContextLines) })
      }
      this.prune(state)
      this.changed(sessionId, state)
    }
    return { ...this.settings }
  }

  observe(sessionId: string, parsed: ParsedError, input: { command?: string; commandFamily?: string; captureMode: CaptureMode; now?: number }): ErrorEvent {
    const state = this.state(sessionId)
    state.observedCommand = true
    const now = input.now ?? Date.now()
    const fingerprint = createFingerprint(parsed, input.commandFamily)
    const existing = state.errors.get(fingerprint)
    if (existing) {
      const remainsIgnored = existing.status === 'ignored'
      const next: ErrorEvent = {
        ...existing,
        status: remainsIgnored ? 'ignored' : 'active',
        lastSeenAt: now,
        ...(remainsIgnored ? {} : { resolvedAt: undefined, ignoredAt: undefined }),
        occurrences: existing.occurrences + 1,
        version: existing.version + 1,
        rawContext: parsed.rawContext.slice(-this.settings.maxErrorContextLines),
        diagnosis: undefined,
        diagnosisError: undefined,
      }
      state.errors.set(fingerprint, next)
      this.prune(state)
      this.changed(sessionId, state)
      return next
    }
    const event: ErrorEvent = {
      id: randomUUID(), fingerprint, version: 1, status: 'active', severity: 'error',
      category: parsed.category, exceptionType: parsed.exceptionType, summary: parsed.summary,
      captureMode: input.captureMode, firstSeenAt: now, lastSeenAt: now, occurrences: 1,
      exceptionChain: parsed.exceptionChain, rawContext: parsed.rawContext.slice(-this.settings.maxErrorContextLines),
      ...(parsed.framework ? { framework: parsed.framework } : {}),
      ...(parsed.language ? { language: parsed.language } : {}),
      ...(parsed.runtime ? { runtime: parsed.runtime } : {}),
      ...(parsed.toolchain ? { toolchain: parsed.toolchain } : {}),
      ...(parsed.parserId ? { parserId: parsed.parserId } : {}),
      ...(parsed.errorCode ? { errorCode: parsed.errorCode } : {}),
      ...(parsed.rootMessage ? { rootMessage: parsed.rootMessage } : {}),
      ...(parsed.target ? { target: parsed.target } : {}),
      ...(parsed.file ? { file: parsed.file } : {}),
      ...(parsed.line !== undefined ? { line: parsed.line } : {}),
      ...(parsed.column !== undefined ? { column: parsed.column } : {}),
      ...(parsed.symbol ? { symbol: parsed.symbol } : {}),
      ...(parsed.port !== undefined ? { port: parsed.port } : {}),
      ...(input.command ? { command: input.command } : {}),
      ...(input.commandFamily ? { commandFamily: input.commandFamily } : {}),
    }
    state.errors.set(fingerprint, event)
    this.prune(state)
    this.changed(sessionId, state)
    return event
  }

  markCommandObserved(sessionId: string): void { const state = this.state(sessionId); state.observedCommand = true; this.changed(sessionId, state) }

  resolve(sessionId: string, fingerprint: string, now = Date.now()): boolean {
    const state = this.state(sessionId); const current = state.errors.get(fingerprint)
    if (!current || current.status === 'resolved') return false
    state.errors.set(fingerprint, { ...current, status: 'resolved', resolvedAt: now, version: current.version + 1 })
    this.prune(state); this.changed(sessionId, state); return true
  }

  ignore(sessionId: string, fingerprint: string, now = Date.now()): boolean {
    const state = this.state(sessionId); const event = state.errors.get(fingerprint)
    if (!event) return false
    state.errors.set(fingerprint, { ...event, status: 'ignored', ignoredAt: now, resolvedAt: undefined, version: event.version + 1 })
    this.prune(state); this.changed(sessionId, state); return true
  }

  unignore(sessionId: string, fingerprint: string): boolean {
    return this.patchError(sessionId, fingerprint, (event) => ({ ...event, status: 'active', ignoredAt: undefined, version: event.version + 1 }))
  }

  resolveCommandFamily(sessionId: string, family: string, now = Date.now()): number {
    const state = this.state(sessionId); let count = 0
    for (const [fingerprint, event] of state.errors) {
      if (event.status === 'active' && event.commandFamily === family && (event.category === 'APPLICATION_STARTUP' || event.framework === 'spring')) {
        state.errors.set(fingerprint, { ...event, status: 'resolved', resolvedAt: now, version: event.version + 1 }); count++
      }
    }
    if (count) { this.prune(state); this.changed(sessionId, state) }
    return count
  }

  setDiagnosis(sessionId: string, fingerprint: string, diagnosis: Diagnosis): boolean {
    return this.patchError(sessionId, fingerprint, (event) => ({ ...event, diagnosis, diagnosisError: undefined }))
  }

  setDiagnosisError(sessionId: string, fingerprint: string, message: string): boolean {
    return this.patchError(sessionId, fingerprint, (event) => ({ ...event, diagnosis: undefined, diagnosisError: message }))
  }

  get(sessionId: string, fingerprint: string): ErrorEvent | undefined { return this.state(sessionId).errors.get(fingerprint) }
  clearResolved(sessionId: string): void { const state = this.state(sessionId); for (const [key, value] of state.errors) if (value.status === 'resolved') state.errors.delete(key); this.changed(sessionId, state) }
  clearAll(sessionId: string): void { const state = this.state(sessionId); state.errors.clear(); state.observedCommand = false; state.droppedActiveErrors = 0; this.changed(sessionId, state) }

  snapshot(sessionId: string): SessionSnapshot {
    const state = this.state(sessionId)
    const all = [...state.errors.values()]
    const active = all.filter((e) => e.status === 'active').sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    const resolved = all.filter((e) => e.status === 'resolved').sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    const ignored = all.filter((e) => e.status === 'ignored').sort((a, b) => (b.ignoredAt ?? b.lastSeenAt) - (a.ignoredAt ?? a.lastSeenAt))
    return { schemaVersion: 3, sessionId, health: active.length ? 'BROKEN' : state.observedCommand ? 'HEALTHY' : 'UNKNOWN', observedCommand: state.observedCommand, active, resolved, ignored, droppedActiveErrors: state.droppedActiveErrors, revision: state.revision, settings: { ...this.settings } }
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    let set = this.listeners.get(sessionId); if (!set) { set = new Set(); this.listeners.set(sessionId, set) }
    set.add(listener); listener(this.snapshot(sessionId))
    return () => { set?.delete(listener); if (!set?.size) this.listeners.delete(sessionId) }
  }

  subscribeAll(listener: Listener): () => void { this.allListeners.add(listener); return () => this.allListeners.delete(listener) }

  restore(snapshot: SessionSnapshot): void {
    const errors = new Map<string, ErrorEvent>()
    const active = snapshot.active.slice(0, this.settings.maxActiveErrors)
    const bounded = [...active, ...snapshot.resolved.slice(0, this.settings.maxResolvedHistory), ...(snapshot.ignored ?? []).slice(0, this.settings.maxIgnoredHistory)]
    for (const event of bounded) errors.set(event.fingerprint, { ...event, rawContext: event.rawContext.slice(-this.settings.maxErrorContextLines) })
    this.sessions.set(snapshot.sessionId, { observedCommand: snapshot.observedCommand, revision: snapshot.revision, droppedActiveErrors: (snapshot.droppedActiveErrors ?? 0) + Math.max(0, snapshot.active.length - active.length), errors })
  }

  private state(id: string): SessionState { let state = this.sessions.get(id); if (!state) { state = { observedCommand: false, revision: 0, droppedActiveErrors: 0, errors: new Map() }; this.sessions.set(id, state) } return state }
  private changed(id: string, state: SessionState): void { state.revision++; const snapshot = this.snapshot(id); for (const listener of this.listeners.get(id) ?? []) listener(snapshot); for (const listener of this.allListeners) listener(snapshot) }
  private patchError(id: string, fingerprint: string, update: (event: ErrorEvent) => ErrorEvent): boolean { const state = this.state(id); const event = state.errors.get(fingerprint); if (!event) return false; state.errors.set(fingerprint, update(event)); this.changed(id, state); return true }
  private prune(state: SessionState): void {
    const active = [...state.errors.values()].filter((e) => e.status === 'active').sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    for (const event of active.slice(this.settings.maxActiveErrors)) { if (state.errors.delete(event.fingerprint)) state.droppedActiveErrors++ }
    const resolved = [...state.errors.values()].filter((e) => e.status === 'resolved').sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    for (const event of resolved.slice(this.settings.maxResolvedHistory)) state.errors.delete(event.fingerprint)
    const ignored = [...state.errors.values()].filter((e) => e.status === 'ignored').sort((a, b) => (b.ignoredAt ?? b.lastSeenAt) - (a.ignoredAt ?? a.lastSeenAt))
    for (const event of ignored.slice(this.settings.maxIgnoredHistory)) state.errors.delete(event.fingerprint)
  }
}
