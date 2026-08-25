import { describe, expect, it } from 'vitest'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { LogHudRuntime } from '../src/host/runtime.js'
import { fixtures } from './fixtures.js'

type Observer = (exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>) => void

function execution(name: string, args: Record<string, unknown>): Readonly<ToolExecution> {
  return { name, arguments: args, agent: { id: 'session-1' } } as unknown as Readonly<ToolExecution>
}

function result(text: string, isError = false): Readonly<ToolExecutionResult> {
  return { content: [{ type: 'text', text }], isError } as unknown as Readonly<ToolExecutionResult>
}

function observer(runtime: LogHudRuntime): Observer {
  return (runtime as unknown as { observeToolResult: Observer }).observeToolResult.bind(runtime)
}

describe('Harness tool-result observation', () => {
  it('correlates a pwsh background job with its final job_output result', () => {
    const runtime = new LogHudRuntime({} as never)
    const observe = observer(runtime)
    const command = 'java -jar .\\examples\\spring-demo\\target\\spring-demo-0.1.0.jar --spring.profiles.active=mybatis'

    observe(execution('pwsh', { command, run_in_background: true }), result('started background job pwsh-1'))
    expect(runtime.store.snapshot('session-1').health).toBe('UNKNOWN')

    observe(execution('job_output', { job_id: 'pwsh-1', wait: true }), result(`${fixtures.mybatis}\n[status: completed, exit code: 1]`))
    const snapshot = runtime.store.snapshot('session-1')
    expect(snapshot.health).toBe('BROKEN')
    expect(snapshot.active).toHaveLength(1)
    expect(snapshot.active[0]?.category).toBe('MYBATIS')
    expect(snapshot.active[0]?.command).toBe(command)
  })

  it('ignores unrelated PowerShell commands when deciding project health', () => {
    const runtime = new LogHudRuntime({} as never)
    observer(runtime)(execution('pwsh', { command: 'Test-Path .\\pom.xml' }), result('True'))
    expect(runtime.store.snapshot('session-1').health).toBe('UNKNOWN')
  })

  it('observes Node and TypeScript command families on Windows and Unix shells', () => {
    const runtime = new LogHudRuntime({} as never); const observe = observer(runtime)
    observe(execution('pwsh', { command: 'pnpm.cmd exec tsc' }), result("src/app.ts(2,4): error TS2322: Type 'string' is not assignable to type 'number'.", true))
    observe(execution('bash', { command: 'node ./src/app.js' }), result('TypeError: user is null\n    at main (/repo/src/app.js:3:2)', true))
    expect(runtime.store.snapshot('session-1').active.map((event) => event.category)).toEqual(expect.arrayContaining(['TYPESCRIPT_COMPILE', 'NODE_RUNTIME']))
  })
})
