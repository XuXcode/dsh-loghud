import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { createElement } from 'react'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { decodeLogHudSettings } from '../shared/validation.js'
import { LogHudOverlay } from './LogHud.js'
import { LogHudSettingsPage } from './SettingsPage.js'

export const inject = ['slots', 'settingsScope', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.slots.register({ name: 'shell.overlay', id: 'dsh-loghud', order: 30 }, LogHudOverlay)
  const scope = ctx.settingsScope.bind({ namespace: 'dsh-loghud', decode: decodeLogHudSettings })
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-loghud', order: 70, label: 'LogHUD' },
    () => createElement(LogHudSettingsPage, { scope, locale: ctx.locale })))
}
