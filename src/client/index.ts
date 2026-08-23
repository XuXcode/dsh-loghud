import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { LogHudOverlay } from './LogHud.js'

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.register({ name: 'shell.overlay', id: 'dsh-loghud', order: 30 }, LogHudOverlay)
}
