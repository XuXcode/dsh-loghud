import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-agent'
import '@deepseek-ai/dsh-host-webserver'
import '@deepseek-ai/dsh-llm'
import '@deepseek-ai/dsh-settings'
import '@deepseek-ai/dsh-storage-domain'
import '@deepseek-ai/dsh-terminal'
import '@deepseek-ai/dsh-tools'
import { LogHudRuntime } from './host/runtime.js'
import { installLogHudSettings } from './host/settings.js'
import type { LogHudSettings } from './shared/types.js'

export const name = 'dsh-loghud'
export const inject = ['tools', 'webServer']

export function apply(ctx: Context, config: Partial<LogHudSettings> = {}): void {
  const runtime = new LogHudRuntime(ctx, config)
  runtime.install()
  installLogHudSettings(ctx, runtime.store, config)
}

export * from './shared/index.js'
