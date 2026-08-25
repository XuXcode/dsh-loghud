import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { TerminalSessionService } from '@deepseek-ai/dsh-terminal'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { describe, expect, it, vi } from 'vitest'
import { LogHudRuntime } from '../src/host/runtime.js'

type StreamingTool = {
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>
}

function agent(id: string): Agent {
  return { id, session: { header: { cwd: 'C:\\workspace' } } } as unknown as Agent
}

function runContext(owner: Agent, signal: AbortSignal): ToolRunContext {
  return { agent: owner, signal, callId: 'call-loghud-run' } as unknown as ToolRunContext
}

function runtimeWith(terminals: TerminalSessionService): LogHudRuntime {
  const ctx = { get: (name: string) => name === 'terminals' ? terminals : undefined } as unknown as Context
  return new LogHudRuntime(ctx)
}

function streamingTool(runtime: LogHudRuntime): StreamingTool {
  return (runtime as unknown as { createStreamingTool(): StreamingTool }).createStreamingTool()
}

describe('loghud_run with the official Terminal surface', () => {
  it('consumes incremental output, records one error, and cleans up the terminal', async () => {
    const output = 'TypeError: loghud smoke test\n    at main (C:\\workspace\\src\\app.js:3:2)\n'
    let reads = 0
    const kill = vi.fn(async () => true)
    const terminals = {
      listBackends: () => ['pwsh'],
      spawn: vi.fn(async () => ({ sessionId: 'terminal-1', motd: '', type: 'pwsh', status: { kind: 'running' } })),
      startSend: vi.fn(() => ({
        done: new Promise((resolve) => setTimeout(() => resolve({ viewport: output, waitReason: 'foreground-exit', sessionStatus: { kind: 'exited', exitCode: 1 }, truncated: false }), 70)),
        readOutput: vi.fn(() => reads++ === 0 ? { delta: output, truncated: false } : { delta: '', truncated: false }),
        cancel: vi.fn(() => false),
      })),
      kill,
    } as unknown as TerminalSessionService
    const runtime = runtimeWith(terminals)
    const owner = agent('stream-session')

    const result = await streamingTool(runtime).execute(
      { command: 'node ./src/app.js', timeoutMs: 2_000 },
      runContext(owner, new AbortController().signal),
    ) as { output: string; exitCode: number | null; waitReason: string; truncated: boolean }

    expect(result).toMatchObject({ exitCode: 1, waitReason: 'foreground-exit', truncated: false })
    expect(result.output).toContain('loghud smoke test')
    expect(runtime.store.snapshot('stream-session').active).toMatchObject([
      { language: 'javascript', category: 'NODE_RUNTIME', exceptionType: 'TypeError', captureMode: 'streaming-tool' },
    ])
    expect(kill).toHaveBeenCalledOnce()
  })

  it('propagates cancellation only after terminal cleanup', async () => {
    const controller = new AbortController()
    const kill = vi.fn(async () => true)
    const terminals = {
      listBackends: () => ['bash'],
      spawn: vi.fn(async () => ({ sessionId: 'terminal-2', motd: '', type: 'bash', status: { kind: 'running' } })),
      startSend: vi.fn((_owner, _sessionId, request: { signal?: AbortSignal }) => ({
        done: new Promise((_resolve, reject) => request.signal?.addEventListener('abort', () => reject(request.signal?.reason), { once: true })),
        readOutput: vi.fn(() => ({ delta: '', truncated: false })),
        cancel: vi.fn(() => true),
      })),
      kill,
    } as unknown as TerminalSessionService
    const runtime = runtimeWith(terminals)
    const pending = streamingTool(runtime).execute(
      { command: 'node ./src/app.js', timeoutMs: 2_000 },
      runContext(agent('cancel-session'), controller.signal),
    )

    setTimeout(() => controller.abort(new Error('cancelled by test')), 20)
    await expect(pending).rejects.toThrow('cancelled by test')
    expect(kill).toHaveBeenCalledOnce()
  })
})
