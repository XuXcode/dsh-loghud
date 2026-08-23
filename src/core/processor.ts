import type { CaptureMode, ErrorEvent } from '../shared/types.js'
import { ErrorBlockCollector } from './block-collector.js'
import { parseErrorBlock } from './parser.js'
import { commandFamily, isSpringSuccess } from './sanitize.js'
import { ErrorStore } from './store.js'

export class LogProcessor {
  private readonly collectors = new Map<string, ErrorBlockCollector>()
  constructor(readonly store: ErrorStore) {}

  push(sessionId: string, chunk: string, input: { command?: string; captureMode: CaptureMode }): ErrorEvent[] {
    const key = `${sessionId}\u001f${input.command ?? ''}\u001f${input.captureMode}`
    let collector = this.collectors.get(key)
    if (!collector) { collector = new ErrorBlockCollector({ maxLines: this.store.settings.maxErrorContextLines }); this.collectors.set(key, collector) }
    const family = commandFamily(input.command)
    return collector.push(chunk).map((block) => this.store.observe(sessionId, parseErrorBlock(block), {
      ...input,
      ...(family ? { commandFamily: family } : {}),
    }))
  }

  finish(sessionId: string, finalChunk: string, input: { command?: string; captureMode: CaptureMode; exitCode?: number }): ErrorEvent[] {
    const key = `${sessionId}\u001f${input.command ?? ''}\u001f${input.captureMode}`
    const collector = this.collectors.get(key) ?? new ErrorBlockCollector({ maxLines: this.store.settings.maxErrorContextLines })
    this.collectors.delete(key)
    const family = commandFamily(input.command)
    const events = [...collector.push(finalChunk), ...collector.finish()].map((block) => this.store.observe(sessionId, parseErrorBlock(block), {
      ...(input.command ? { command: input.command } : {}),
      ...(family ? { commandFamily: family } : {}),
      captureMode: input.captureMode,
    }))
    this.store.markCommandObserved(sessionId)
    if (family && input.exitCode === 0 && events.length === 0 && isSpringSuccess(finalChunk.split(/\r?\n/))) this.store.resolveCommandFamily(sessionId, family)
    return events
  }
}
