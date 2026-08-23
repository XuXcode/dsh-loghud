const ANSI = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F]/g

export function cleanLogText(value: string): string {
  return value.replace(ANSI, '').replace(CONTROL, '').replace(/\r(?!\n)/g, '\n').replace(/\r\n/g, '\n')
}

export function normalizeMessage(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, '<time>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/@[0-9a-f]+\b/gi, '@<id>')
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
  return normalized.split(' ').slice(0, 2).join(':').toLowerCase()
}

export function isSpringSuccess(lines: readonly string[]): boolean {
  return lines.some((line) => /Started\s+[\w$.-]+\s+in\s+[\d.]+\s+seconds/i.test(line) || /BUILD SUCCESS/i.test(line))
}
