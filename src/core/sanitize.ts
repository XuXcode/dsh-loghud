const ANSI = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F]/g

export function cleanLogText(value: string): string {
  return value.replace(ANSI, '').replace(CONTROL, '').replace(/\r(?!\n)/g, '\n').replace(/\r\n/g, '\n')
}

export function normalizeMessage(value: string): string {
  return value
    .toLowerCase()
    .replace(/file:\/\/\/[^ \t\r\n)]+/gi, '<path>')
    .replace(/[a-z]:\\(?:[^\\\s:]+\\)*[^\\\s:]+/gi, '<path>')
    .replace(/\/(?:[^/\s:]+\/)+[^/\s:]+/g, '<path>')
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, '<time>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b(?:build|chunk|bundle)[-_ ]?(?:hash)?[:= ]+[a-z0-9_-]{6,}\b/gi, '<build-hash>')
    .replace(/@[0-9a-f]+\b/gi, '@<id>')
    .replace(/\b(?:pid|process)\s*[:=]?\s*\d+\b/gi, 'pid <n>')
    .replace(/\bport\s+\d+\b/gi, 'port <n>')
    .replace(/:\d{2,5}\b/g, ':<port>')
    .replace(/\bline \d+\b/gi, 'line <n>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function commandFamily(command?: string): string | undefined {
  if (!command) return undefined
  const normalized = command.trim().replace(/\s+/g, ' ')
  if (/\bmvn(?:w|\.cmd)?\s+.*spring-boot:run/i.test(normalized)) return 'maven:spring-boot:run'
  if (/\bmvn(?:w|\.cmd)?\s+.*\btest\b/i.test(normalized)) return 'maven:test'
  if (/\bgradlew?(?:\.bat)?\s+.*bootRun/i.test(normalized)) return 'gradle:bootRun'
  if (/\bjava\s+(?:-[^ ]+\s+)*-jar\b/i.test(normalized)) return 'java:jar'
  const packageRun = normalized.match(/\b(npm|pnpm|yarn)(?:\.cmd)?\s+(?:run\s+)?([\w:-]+)/i)
  if (packageRun?.[1] && packageRun[2]) return `${packageRun[1].toLowerCase()}:run:${packageRun[2].toLowerCase()}`
  const runner = normalized.match(/\b(npx|tsx|ts-node|tsc|vite|webpack|next|vitest|jest)(?:\.cmd)?\b/i)?.[1]
  if (runner) return `node:${runner.toLowerCase()}`
  if (/\bnode(?:\.exe)?\b/i.test(normalized)) return 'node:script'
  return normalized.split(' ').slice(0, 2).join(':').toLowerCase()
}

export function detectToolchain(command?: string): import('../shared/types.js').Toolchain | undefined {
  if (!command) return undefined
  const value = command.toLowerCase()
  for (const tool of ['pnpm', 'npm', 'yarn', 'vite', 'rollup', 'webpack', 'next', 'vitest', 'jest'] as const) if (new RegExp(`\\b${tool}(?:\\.cmd)?\\b`).test(value)) return tool
  if (/\b(?:tsc|tsx|ts-node)(?:\.cmd)?\b/.test(value)) return 'typescript'
  if (/\bnode(?:\.exe)?\b/.test(value)) return 'node'
  if (/\bmvnw?(?:\.cmd)?\b/.test(value)) return 'maven'
  if (/\bgradlew?(?:\.bat)?\b/.test(value)) return 'gradle'
  if (/\bjava(?:\.exe)?\b/.test(value)) return 'java'
  return undefined
}

export function isSpringSuccess(lines: readonly string[]): boolean {
  return lines.some((line) => /Started\s+[\w$.-]+\s+in\s+[\d.]+\s+seconds/i.test(line) || /BUILD SUCCESS/i.test(line))
}
