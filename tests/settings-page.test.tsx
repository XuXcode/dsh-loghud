// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { LogHudSettingsPage, type LocaleSource } from '../src/client/SettingsPage.js'
import { DEFAULT_SETTINGS, type LogHudSettings } from '../src/shared/types.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

class FakeScope implements SettingsScope<LogHudSettings> {
  private listeners = new Set<() => void>()
  snapshot: SettingsScopeSnapshot<LogHudSettings>
  writes: Array<[string, unknown]> = []
  resets: string[] = []
  constructor(input: Partial<SettingsScopeSnapshot<LogHudSettings>> = {}) {
    this.snapshot = { status: 'ready', value: { ...DEFAULT_SETTINGS }, base: { ...DEFAULT_SETTINGS }, user: {}, revision: 1, writable: true, mode: 'host', ...input }
  }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  async set(field: string, value: unknown) {
    this.writes.push([field, value])
    this.snapshot = { ...this.snapshot, value: { ...this.snapshot.value!, [field]: value }, user: { ...(this.snapshot.user as object), [field]: value }, revision: (this.snapshot.revision ?? 0) + 1 }
    this.emit()
  }
  async unset(field: string) {
    this.resets.push(field)
    const user = { ...(this.snapshot.user as Record<string, unknown>) }; delete user[field]
    this.snapshot = { ...this.snapshot, value: { ...this.snapshot.value!, [field]: DEFAULT_SETTINGS[field as keyof LogHudSettings] }, user, revision: (this.snapshot.revision ?? 0) + 1 }
    this.emit()
  }
  private emit() { for (const listener of this.listeners) listener() }
}

class FakeLocale implements LocaleSource {
  private listeners = new Set<() => void>()
  snapshot = { active: 'en' }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  set(active: string) { this.snapshot = { active }; for (const listener of this.listeners) listener() }
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

async function render(scope = new FakeScope(), locale = new FakeLocale()) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  await act(async () => root.render(<LogHudSettingsPage scope={scope} locale={locale} />))
  return { host, root, scope, locale }
}

describe('Harness LogHUD settings page', () => {
  it('writes switches immediately and resets an overridden field', async () => {
    const view = await render(); const enabled = view.host.querySelector<HTMLInputElement>('#loghud-enabled')!
    await act(async () => enabled.click())
    expect(view.scope.writes).toEqual([['enabled', false]])
    const reset = [...view.host.querySelectorAll('button')].find((button) => button.parentElement?.parentElement?.querySelector('#loghud-enabled') && button.textContent === 'Reset')!
    await act(async () => reset.click())
    expect(view.scope.resets).toContain('enabled')
    await act(async () => view.root.unmount())
  })

  it('validates numeric ranges and saves on blur', async () => {
    const view = await render(); const input = view.host.querySelector<HTMLInputElement>('#loghud-maxActiveErrors')!
    await act(async () => { input.focus(); setInputValue(input, '9'); input.blur() })
    expect(view.scope.writes).toHaveLength(0)
    expect(view.host.textContent).toContain('Enter a whole number from 10 to 500.')
    await act(async () => { input.focus(); setInputValue(input, '125'); input.blur(); await Promise.resolve() })
    expect(view.scope.writes).toContainEqual(['maxActiveErrors', 125])
    await act(async () => view.root.unmount())
  })

  it('follows the Harness locale and displays unavailable/read-only feedback', async () => {
    const scope = new FakeScope({ status: 'unavailable', value: undefined, writable: false, mode: 'memory' }); const locale = new FakeLocale()
    const view = await render(scope, locale)
    expect(view.host.textContent).toContain('Settings are unavailable')
    await act(async () => locale.set('zh'))
    expect(view.host.textContent).toContain('当前浏览器无法使用设置服务')
    expect(view.host.querySelector<HTMLInputElement>('#loghud-enabled')?.matches(':disabled')).toBe(true)
    await act(async () => view.root.unmount())
  })
})

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
