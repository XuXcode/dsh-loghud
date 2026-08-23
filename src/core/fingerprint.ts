import { createHash } from 'node:crypto'
import type { ParsedError } from '../shared/types.js'
import { normalizeMessage } from './sanitize.js'

export function createFingerprint(error: ParsedError, commandFamily?: string): string {
  const material = [error.framework, error.category, error.exceptionType, normalizeMessage(error.rootMessage ?? error.summary), error.target, error.file, error.symbol, commandFamily]
    .map((item) => item ?? '').join('\u001f')
  return createHash('sha256').update(material).digest('hex').slice(0, 24)
}
