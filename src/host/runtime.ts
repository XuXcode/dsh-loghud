import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage, type ContentBlock, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { defineTool, type ToolExecution, type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type { TerminalSessionService } from '@deepseek-ai/dsh-terminal'
import { DiagnosisService, ErrorStore, LogProcessor } from '../core/index.js'
import type { Diagnosis, DiagnosisLocale, ErrorEvent, LogHudSettings } from '../shared/types.js'
import { objectBody, json, pathParts, readJson } from './http.js'
import { openPersistence } from './persistence.js'

const SHELL_TOOL = /(?:bash|shell|pwsh|powershell|terminal|command|exec)/i
const JOB_OUTPUT_TOOL = /(?:^|[/_-])job[/_-]?output$/i
const BACKGROUND_JOB_STARTED = /started background job\s+([^\s]+)/i
const SETTLED_JOB = /\[status:\s*(?:completed|failed|killed|cancelled),\s*exit code:\s*-?\d+\]/i
const EXIT_CODE = /\bexit code:\s*(-?\d+)\b/i
const SUPPORTED_COMMAND = /(?:^|[\s"'])(?:java|mvn|mvnw|gradle|gradlew|node|npm|pnpm|yarn|npx|tsx|ts-node|tsc|vite|webpack|next|vitest|jest)(?:\.cmd|\.bat|\.exe)?(?:[\s"']|$)|spring-boot/i
const SUPPORTED_OUTPUT = /(?:Spring Boot|Application run failed|Error starting ApplicationContext|(?:Caused by:\s*)?(?:[\w$]+\.)+(?:Exception|Error)(?::|\s)|\b(?:TypeError|ReferenceError|SyntaxError|RangeError|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|EADDRINUSE|ECONNREFUSED|TS\d{4}|ELIFECYCLE)\b)/i
const API_PREFIX = '/api/loghud'

export class LogHudRuntime {
  readonly store: ErrorStore
  readonly processor: LogProcessor
  private readonly agents = new Map<string, Agent>()
  private readonly diagnosisInflight = new Map<string, Promise<Diagnosis>>()
  private readonly backgroundJobs = new Map<string, { sessionId: string; command?: string }>()

  constructor(private readonly ctx: Context, settings: Partial<LogHudSettings> = {}) {
    this.store = new ErrorStore(settings)
    this.processor = new LogProcessor(this.store)
  }

  install(): void {
    this.ctx.on('tools/result', (exec, result) => { this.observeToolResult(exec, result); return undefined })
    this.ctx.tools.register(this.createStreamingTool())
    this.ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler: (req, res) => this.handleHttp(req, res) })
    this.ctx.inject(['storageDomain'], async (storageCtx) => openPersistence(storageCtx.storageDomain, this.store))
  }

  private observeToolResult(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): void {
    if (!this.store.settings.enabled || !exec.agent || exec.name === 'loghud_run') return
    const shell = SHELL_TOOL.test(exec.name)
    const jobOutput = JOB_OUTPUT_TOOL.test(exec.name)
    if (!shell && !jobOutput) return
    const sessionId = String(exec.agent.id)
    let command = extractCommand(exec.arguments)
    const output = extractText(result.content)
    if (shell) {
      const started = output.match(BACKGROUND_JOB_STARTED)?.[1]
      if (started && command && isSupportedCandidate(command, output)) {
        this.rememberBackgroundJob(started, sessionId, command)
        this.agents.set(sessionId, exec.agent)
        return
      }
    }
    if (jobOutput) {
      const jobId = extractJobId(exec.arguments)
      const job = jobId ? this.backgroundJobs.get(backgroundJobKey(sessionId, jobId)) : undefined
      command = command ?? job?.command
      if (!SETTLED_JOB.test(output)) return
      if (jobId) this.backgroundJobs.delete(backgroundJobKey(sessionId, jobId))
    }
    if ((!command && !output) || !isSupportedCandidate(command, output)) return
    this.agents.set(sessionId, exec.agent)
    this.processor.finish(sessionId, output, {
      ...(command ? { command } : {}),
      captureMode: 'tool-result',
      exitCode: extractExitCode(output) ?? (result.isError ? 1 : 0),
    })
  }

  private rememberBackgroundJob(jobId: string, sessionId: string, command: string): void {
    this.backgroundJobs.set(backgroundJobKey(sessionId, jobId), { sessionId, command })
    while (this.backgroundJobs.size > 128) this.backgroundJobs.delete(this.backgroundJobs.keys().next().value as string)
  }

  private createStreamingTool() {
    return defineTool({
      name: 'loghud_run',
      description: 'Run a local command in an official Harness terminal while LogHUD incrementally monitors Java, Spring, Node.js, and TypeScript errors.',
      parameters: {
        command: { type: 'string', required: true, description: 'Command to run' },
        timeoutMs: { type: 'integer', description: 'Cooperative timeout in milliseconds (1000-600000)' },
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false, properties: {
            output: { type: 'string', required: true },
            exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }], required: true },
            waitReason: { type: 'string', required: true },
            truncated: { type: 'boolean', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.output || `(command finished: ${value.waitReason})` }],
      },
      timeoutMs: 610_000,
      execute: async (args, exec) => {
        if (!exec.agent) throw new Error('loghud_run requires an active Agent session')
        const terminals = this.ctx.get('terminals') as TerminalSessionService | undefined
        if (!terminals) throw new Error('Real-time mode unavailable: no official terminal service is loaded')
        const backends = terminals.listBackends()
        if (!backends.length) throw new Error('Real-time mode unavailable: no terminal backend is registered')
        const timeoutMs = Math.min(600_000, Math.max(1_000, args.timeoutMs ?? 120_000))
        const signal = AbortSignal.any([exec.signal, AbortSignal.timeout(timeoutMs)])
        const owner = exec.agent
        this.agents.set(String(owner.id), owner)
        const spawned = await terminals.spawn(owner, {
          type: preferredBackend(backends),
          name: `loghud-${String(exec.callId).slice(-8)}`,
          ...(owner.session.header.cwd ? { cwd: owner.session.header.cwd } : {}),
        }, signal)
        let output = ''
        try {
          const operation = terminals.startSend(owner, spawned.sessionId, { text: args.command, submit: true, signal })
          let settled = false
          void operation.done.finally(() => { settled = true })
          while (!settled) {
            const read = operation.readOutput()
            if (read.delta) {
              output = appendBounded(output, read.delta)
              this.processor.push(String(owner.id), read.delta, { command: args.command, captureMode: 'streaming-tool' })
            }
            await delay(50, signal).catch(() => undefined)
          }
          const result = await operation.done
          const finalRead = operation.readOutput()
          if (finalRead.delta) output = appendBounded(output, finalRead.delta)
          const exitCode = result.sessionStatus.kind === 'exited' ? result.sessionStatus.exitCode : null
          this.processor.finish(String(owner.id), finalRead.delta, { command: args.command, captureMode: 'streaming-tool', ...(exitCode !== null ? { exitCode: exitCode ?? 1 } : {}) })
          return { output, exitCode, waitReason: result.waitReason, truncated: result.truncated || finalRead.truncated }
        } finally {
          await terminals.kill(owner, spawned.sessionId, 'loghud_run settled').catch(() => false)
        }
      },
      presentCall: (args) => ({ card: 'terminal', title: 'LogHUD real-time run', description: args.command }),
      presentResult: (_args, result) => ({ card: 'terminal', title: 'LogHUD real-time run', output: extractText(result.content) }),
    })
  }

  private async handleHttp(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<void> {
    try {
      const parts = pathParts(req)
      const sessionId = parts[2]
      const action = parts[3]
      if (!sessionId) return json(res, 400, { error: 'Missing session id' })
      if (req.method === 'GET' && action === 'snapshot') return json(res, 200, this.store.snapshot(sessionId))
      if (req.method === 'GET' && action === 'events') return this.openSse(sessionId, req, res)
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
      const body = objectBody(await readJson(req))
      if (action === 'resolve') {
        const fingerprint = requiredString(body.fingerprint, 'fingerprint')
        return json(res, this.store.resolve(sessionId, fingerprint) ? 200 : 404, this.store.snapshot(sessionId))
      }
      if (action === 'ignore') {
        const fingerprint = requiredString(body.fingerprint, 'fingerprint')
        return json(res, this.store.ignore(sessionId, fingerprint) ? 200 : 404, this.store.snapshot(sessionId))
      }
      if (action === 'unignore') {
        const fingerprint = requiredString(body.fingerprint, 'fingerprint')
        return json(res, this.store.unignore(sessionId, fingerprint) ? 200 : 404, this.store.snapshot(sessionId))
      }
      if (action === 'clear-resolved') { this.store.clearResolved(sessionId); return json(res, 200, this.store.snapshot(sessionId)) }
      if (action === 'clear') { this.store.clearAll(sessionId); return json(res, 200, this.store.snapshot(sessionId)) }
      if (action === 'diagnose') return await this.diagnose(sessionId, body, res)
      return json(res, 404, { error: 'Unknown loghud endpoint' })
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request' })
    }
  }

  private openSse(sessionId: string, req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' })
    let pending: import('../shared/types.js').SessionSnapshot | undefined
    let flush: ReturnType<typeof setTimeout> | undefined
    const send = (data: import('../shared/types.js').SessionSnapshot) => {
      pending = data
      if (!flush) flush = setTimeout(() => { if (pending) res.write(`id: ${pending.revision}\nevent: snapshot\ndata: ${JSON.stringify(pending)}\n\n`); flush = undefined }, 25)
    }
    const dispose = this.store.subscribe(sessionId, send)
    const heartbeat = setInterval(() => res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`), 15_000)
    req.once('close', () => { clearInterval(heartbeat); if (flush) clearTimeout(flush); dispose(); res.end() })
  }

  private async diagnose(sessionId: string, body: Record<string, unknown>, res: import('node:http').ServerResponse): Promise<void> {
    if (!this.store.settings.enableAiAnalysis) return json(res, 403, { error: 'AI analysis is disabled' })
    const fingerprint = requiredString(body.fingerprint, 'fingerprint')
    const locale = diagnosisLocale(body.locale)
    const event = this.store.get(sessionId, fingerprint)
    if (!event) return json(res, 404, { error: 'Unknown fingerprint' })
    if (typeof body.version === 'number' && body.version !== event.version) return json(res, 409, { error: 'Error card changed; retry with its current version' })
    const agent = this.agents.get(sessionId)
    const llm = this.ctx.get('llm')
    const provider = agent?.options.provider
    const model = agent?.options.model
    if (!llm || !provider || !model) return json(res, 503, { error: 'AI analysis unavailable. The error was still detected locally.' })
    const key = `${sessionId}:${event.fingerprint}:${event.version}:${locale}`
    const existing = this.diagnosisInflight.get(key)
    if (existing) {
      try { return json(res, 200, await existing) } catch { return json(res, 503, { error: 'AI analysis unavailable. The error was still detected locally.' }) }
    }
    const service = new DiagnosisService({ generate: async (prompt, signal) => {
      let text = ''
      const message = createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'plugin', plugin: 'dsh-loghud' } })
      for await (const chunk of llm.stream({ provider, model, messages: [message], ...(signal ? { signal } : {}) })) {
        if ((chunk as StreamChunk).type === 'text-delta') text += (chunk as Extract<StreamChunk, { type: 'text-delta' }>).text
        if ((chunk as StreamChunk).type === 'finish') {
          const reason = (chunk as Extract<StreamChunk, { type: 'finish' }>).reason
          if (reason.kind === 'error' || reason.kind === 'aborted') throw new Error('AI analysis unavailable. The error was still detected locally.')
        }
      }
      return text
    } }, this.store.settings.secretRedaction)
    const pending = service.diagnose(event, AbortSignal.timeout(45_000), locale).finally(() => this.diagnosisInflight.delete(key))
    this.diagnosisInflight.set(key, pending)
    try {
      const diagnosis = await pending
      this.store.setDiagnosis(sessionId, fingerprint, diagnosis)
      json(res, 200, diagnosis)
    } catch {
      const message = 'AI analysis unavailable. The error was still detected locally.'
      this.store.setDiagnosisError(sessionId, fingerprint, message)
      json(res, 503, { error: message })
    }
  }
}

function extractCommand(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  for (const key of ['command', 'cmd', 'script', 'text']) if (typeof input[key] === 'string' && input[key]) return input[key]
  return undefined
}

function extractJobId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  for (const key of ['job_id', 'jobId', 'id']) if (typeof input[key] === 'string' && input[key]) return input[key]
  return undefined
}

function isSupportedCandidate(command: string | undefined, output: string): boolean {
  return Boolean(command && SUPPORTED_COMMAND.test(command)) || SUPPORTED_OUTPUT.test(output)
}

function extractExitCode(output: string): number | undefined {
  const value = output.match(EXIT_CODE)?.[1]
  if (value === undefined) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function backgroundJobKey(sessionId: string, jobId: string): string { return `${sessionId}\u001f${jobId}` }

function extractText(content: readonly ContentBlock[]): string {
  return content.flatMap((block) => block.type === 'text' || block.type === 'reasoning' ? [block.text] : block.type === 'tool-result' ? [extractText(block.content)] : []).join('\n')
}

function preferredBackend(backends: string[]): string { return backends.find((name) => /powershell|pwsh|bash|shell/i.test(name)) ?? backends[0]! }
function appendBounded(previous: string, delta: string): string { return (previous + delta).slice(-100_000) }
function requiredString(value: unknown, name: string): string { if (typeof value !== 'string' || !value) throw new Error(`Missing ${name}`); return value }
function diagnosisLocale(value: unknown): DiagnosisLocale { return typeof value === 'string' && value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en' }
function delay(ms: number, signal: AbortSignal): Promise<void> { return new Promise((resolve, reject) => { const timer = setTimeout(resolve, ms); signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true }) }) }
