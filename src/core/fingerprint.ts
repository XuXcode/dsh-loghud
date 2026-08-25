import { createHash } from 'node:crypto'
import type { ParsedError } from '../shared/types.js'
import { normalizeMessage } from './sanitize.js'

export function createFingerprint(error: ParsedError, commandFamily?: string): string {
  const material = [error.language, error.runtime, error.toolchain, error.parserId, error.framework, error.category, error.exceptionType, error.errorCode, normalizeMessage(error.rootMessage ?? error.summary), normalizePath(error.target), normalizePath(error.file), error.symbol, commandFamily]
    .map((item) => item ?? '').join('\u001f')
  return createHash('sha256').update(material).digest('hex').slice(0, 24)
}

function normalizePath(value?: string): string | undefined {
  if (!value) return undefined
  return value.replace(/\\/g, '/').replace(/^file:\/\//, '').replace(/^(?:[a-z]:)?\/.+?\/(src|test|tests|app|server|client)\//i, '$1/').replace(/(?:^|\/)node_modules\/.*/i, '<dependency>')
}
