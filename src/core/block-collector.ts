import type { ErrorDetectionRule } from '../shared/types.js'
import { cleanLogText } from './sanitize.js'
import { DEFAULT_RULES, matchRule } from './rules.js'

export interface ErrorBlock { lines: string[]; rule: ErrorDetectionRule }
export interface CollectorOptions { maxLines?: number; normalBoundaryLines?: number; rules?: readonly ErrorDetectionRule[] }

export class ErrorBlockCollector {
  private tail = ''
  private current: string[] = []
  private rule: ErrorDetectionRule | undefined
  private normalLines = 0
  private readonly maxLines: number
  private readonly normalBoundaryLines: number
  private readonly rules: readonly ErrorDetectionRule[]

  constructor(options: CollectorOptions = {}) {
    this.maxLines = Math.max(10, options.maxLines ?? 120)
    this.normalBoundaryLines = Math.max(1, options.normalBoundaryLines ?? 2)
    this.rules = options.rules ?? DEFAULT_RULES
  }

  push(chunk: string): ErrorBlock[] {
    const normalized = cleanLogText(this.tail + chunk)
    const lines = normalized.split('\n')
    this.tail = lines.pop() ?? ''
    const blocks: ErrorBlock[] = []
    for (const line of lines) blocks.push(...this.acceptLine(line))
    return blocks
  }

  finish(): ErrorBlock[] {
    const blocks: ErrorBlock[] = []
    if (this.tail) blocks.push(...this.acceptLine(cleanLogText(this.tail)))
    this.tail = ''
    const final = this.flush()
    if (final) blocks.push(final)
    return blocks
  }

  private acceptLine(line: string): ErrorBlock[] {
    const matched = matchRule(line, this.rules)
    if (!this.rule) {
      if (matched) { this.rule = matched; this.current = [line]; this.normalLines = 0 }
      return []
    }

    const isContinuation = /^\s+(?:at\s|\.\.\.\s+\d+\s+more|Caused by:|Suppressed:)/.test(line)
      || /^Caused by:|^Suppressed:|^APPLICATION FAILED TO START|^Description:|^Action:/.test(line)
      || line.trim() === ''
      || /^[-=*]{3,}$/.test(line.trim())

    if (matched && !isContinuation && this.current.length > 0 && isDistinctErrorStart(line)) {
      const previous = this.flush()
      this.rule = matched
      this.current = [line]
      return previous ? [previous] : []
    }

    this.current.push(line)
    this.normalLines = isContinuation || matched ? 0 : this.normalLines + 1
    if (this.current.length >= this.maxLines || this.normalLines >= this.normalBoundaryLines) {
      const block = this.flush()
      return block ? [block] : []
    }
    return []
  }

  private flush(): ErrorBlock | undefined {
    if (!this.rule || this.current.length === 0) return undefined
    while (this.current.at(-1)?.trim() === '') this.current.pop()
    const result = { lines: this.current.slice(0, this.maxLines), rule: this.rule }
    this.current = []
    this.rule = undefined
    this.normalLines = 0
    return result
  }
}

function isDistinctErrorStart(line: string): boolean {
  return !/^\s/.test(line)
    && !/^Caused by:|^Suppressed:/.test(line)
    && !/^APPLICATION FAILED TO START|^Web server failed to start|^Port \d+ was already in use/.test(line)
}
