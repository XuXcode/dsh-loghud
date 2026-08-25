// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { clampHudPosition, LogHudOverlay } from '../src/client/LogHud.js'
import type { ErrorEvent, SessionSnapshot } from '../src/shared/types.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const error: ErrorEvent = {
  id: 'e', fingerprint: 'fingerprint', version: 1, status: 'active', severity: 'error', framework: 'java', category: 'JAVA_RUNTIME',
  exceptionType: 'NullPointerException', summary: 'user is null', file: 'UserService.java', line: 27, captureMode: 'tool-result',
  firstSeenAt: 1, lastSeenAt: 1, occurrences: 2, exceptionChain: ['NullPointerException'], rawContext: ['java.lang.NullPointerException: user is null'],
}
const snapshot: SessionSnapshot = { schemaVersion: 2, sessionId: 's1', health: 'BROKEN', observedCommand: true, active: [error], resolved: [], ignored: [], revision: 1 }
const list = { current: 's1' } as SessionListState
const useSessions = ((selector: (value: SessionListState) => unknown) => selector(list)) as SnapshotSelectorHook<SessionListState>

class FakeEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  addEventListener(): void {}
  close(): void {}
}

afterEach(() => vi.unstubAllGlobals())

describe('client HUD', () => {
  it('keeps a dragged HUD inside the visible viewport', () => {
    expect(clampHudPosition({ x: -100, y: -20 }, { width: 120, height: 36 }, { width: 500, height: 300 })).toEqual({ x: 8, y: 8 })
    expect(clampHudPosition({ x: 999, y: 999 }, { width: 120, height: 36 }, { width: 500, height: 300 })).toEqual({ x: 372, y: 256 })
  })

  it('renders BROKEN state, detail folding, and successful on-demand diagnosis', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/diagnose')) return new Response(JSON.stringify({ simpleExplanation: 'A user object is missing.', likelyCauses: ['No lookup result'], suggestedChecks: ['Check the id'], confidence: 'high' }), { status: 200 })
      return new Response(JSON.stringify(snapshot), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('EventSource', FakeEventSource)
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
    await act(async () => { root.render(<LogHudOverlay useSessions={useSessions} />); await Promise.resolve() })
    const badge = host.querySelector('button')!; expect(badge.getAttribute('aria-label')).toContain('BROKEN')
    await act(async () => badge.click())
    expect(host.textContent).toContain('Active errors'); expect(host.textContent).toContain('NullPointerException'); expect(host.textContent).toContain('×2')
    const card = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('NullPointerException'))!
    await act(async () => card.click())
    expect(host.textContent).toContain('Captured context'); expect(host.textContent).toContain('tool-result')
    const ai = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Explain with AI'))!
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/diagnose'))).toHaveLength(0)
    await act(async () => { ai.click(); await Promise.resolve(); await Promise.resolve() })
    const diagnosisCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/diagnose'))
    expect(diagnosisCalls).toHaveLength(1)
    expect(JSON.parse(String(diagnosisCalls[0]?.[1]?.body))).toMatchObject({ locale: 'en' })
    await act(async () => root.unmount()); host.remove()
  })

  it('uses Chinese browser copy and Harness theme variables', async () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'zh-CN' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...snapshot, health: 'HEALTHY', active: [] }), { status: 200 })))
    vi.stubGlobal('EventSource', FakeEventSource)
    const host = document.createElement('div'); const root = createRoot(host)
    await act(async () => { root.render(<LogHudOverlay useSessions={useSessions} />); await Promise.resolve() })
    expect(host.textContent).toContain('LogHUD')
    await act(async () => host.querySelector('button')?.click())
    expect(host.textContent).toContain('活动错误')
    expect(host.textContent).not.toContain('✨')
    expect(host.innerHTML).toContain('var(--dsw-alias-bg-layer-2')
    expect(host.innerHTML).toContain('var(--dsw-alias-label-primary')
    expect(host.innerHTML).toContain('var(--dsw-alias-state-success-primary')
    expect(host.innerHTML).not.toContain('var(--color-')
    await act(async () => root.unmount())
  })
})
