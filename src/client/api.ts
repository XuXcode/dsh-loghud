import type { ConnectionState, Diagnosis, DiagnosisLocale, SessionSnapshot } from '../shared/types.js'

const root = '/api/loghud'

export async function getSnapshot(sessionId: string): Promise<SessionSnapshot> {
  return request(`${root}/${encodeURIComponent(sessionId)}/snapshot`)
}

export function subscribe(sessionId: string, update: (snapshot: SessionSnapshot) => void, connection?: (state: ConnectionState) => void): () => void {
  connection?.('connecting')
  const source = new EventSource(`${root}/${encodeURIComponent(sessionId)}/events`)
  let opened = false
  source.onopen = () => { opened = true; connection?.('connected') }
  source.onerror = () => connection?.(opened ? 'reconnecting' : 'offline')
  source.addEventListener('heartbeat', () => connection?.('connected'))
  source.addEventListener('snapshot', (event) => update(JSON.parse((event as MessageEvent<string>).data) as SessionSnapshot))
  return () => { source.close(); connection?.('offline') }
}

export function resolveError(sessionId: string, fingerprint: string): Promise<SessionSnapshot> {
  return request(`${root}/${encodeURIComponent(sessionId)}/resolve`, { method: 'POST', body: JSON.stringify({ fingerprint }) })
}

export function ignoreError(sessionId: string, fingerprint: string): Promise<SessionSnapshot> {
  return request(`${root}/${encodeURIComponent(sessionId)}/ignore`, { method: 'POST', body: JSON.stringify({ fingerprint }) })
}

export function unignoreError(sessionId: string, fingerprint: string): Promise<SessionSnapshot> {
  return request(`${root}/${encodeURIComponent(sessionId)}/unignore`, { method: 'POST', body: JSON.stringify({ fingerprint }) })
}

export function clearResolved(sessionId: string): Promise<SessionSnapshot> {
  return request(`${root}/${encodeURIComponent(sessionId)}/clear-resolved`, { method: 'POST', body: '{}' })
}

export function clearAll(sessionId: string): Promise<SessionSnapshot> {
  return request(`${root}/${encodeURIComponent(sessionId)}/clear`, { method: 'POST', body: '{}' })
}

export function diagnose(sessionId: string, fingerprint: string, version: number, locale: DiagnosisLocale): Promise<Diagnosis> {
  return request(`${root}/${encodeURIComponent(sessionId)}/diagnose`, { method: 'POST', body: JSON.stringify({ fingerprint, version, locale }) })
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const body = await response.json() as T | { error?: string }
  if (!response.ok) throw new Error('error' in (body as object) && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : `HTTP ${response.status}`)
  return body as T
}
