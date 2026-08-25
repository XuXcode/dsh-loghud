import type { SessionSnapshot } from '../shared/types.js'

export function snapshotMarkdown(snapshot: SessionSnapshot): string {
  const sections = [['Active', snapshot.active], ['Resolved', snapshot.resolved], ['Ignored', snapshot.ignored]] as const
  const lines = [`# LogHUD session ${snapshot.sessionId}`, '', `Health: ${snapshot.health}`, `Revision: ${snapshot.revision}`, '']
  for (const [title, events] of sections) {
    lines.push(`## ${title} (${events.length})`, '')
    for (const event of events) lines.push(`- **${event.exceptionType}**: ${event.summary}${event.file ? ` (${event.file}${event.line ? `:${event.line}${event.column ? `:${event.column}` : ''}` : ''})` : ''} — ${event.occurrences} occurrence(s)`)
    if (!events.length) lines.push('- None')
    lines.push('')
  }
  return lines.join('\n')
}

export function downloadSnapshot(snapshot: SessionSnapshot, format: 'json' | 'markdown'): void {
  const text = format === 'json' ? JSON.stringify(snapshot, null, 2) : snapshotMarkdown(snapshot)
  const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/markdown' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href; anchor.download = `loghud-${snapshot.sessionId}.${format === 'json' ? 'json' : 'md'}`; anchor.click()
  URL.revokeObjectURL(href)
}
