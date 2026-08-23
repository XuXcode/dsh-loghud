const RULES: Array<[RegExp, string]> = [
  [/\b(Authorization\s*:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]'],
  [/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]'],
  [/\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]'],
  [/(https?:\/\/[^\s:@/]+):([^\s@/]+)@/gi, '$1:[REDACTED]@'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, '[REDACTED JWT]'],
]

export function redactSecrets(value: string): string { return RULES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value) }
export function redactLines(lines: readonly string[]): string[] { return lines.map(redactSecrets) }
