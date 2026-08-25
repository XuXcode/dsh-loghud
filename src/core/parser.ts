import type { CaptureMode, ErrorCategory, ParsedError, RuntimeLanguage, Toolchain } from '../shared/types.js'
import type { ErrorBlock } from './block-collector.js'
import { detectToolchain } from './sanitize.js'

export interface ParseContext {
  command?: string
  commandFamily?: string
  captureMode?: CaptureMode
}

export interface LogErrorParser {
  id: string
  priority: number
  supports(block: ErrorBlock, context: ParseContext): boolean
  parse(block: ErrorBlock, context: ParseContext): ParsedError | undefined
}

const JAVA_EXCEPTION = /(?:^|Caused by:\s*|Suppressed:\s*)(?:[\w$]+\.)*([A-Za-z_$][\w$]*(?:Exception|Error))(?::\s*(.*))?/
const JAVA_FRAME = /\bat\s+(?:[\w$]+\.)*([\w$]+)\.([\w$<>]+)\(([^():]+):(\d+)\)/
const NODE_ERROR = /(?:^|\s)(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError|UnhandledPromiseRejection(?:Warning)?)(?::\s*(.*))?/
const NODE_CODE = /(?:code:\s*['"]|\[)(ERR_[A-Z0-9_]+|MODULE_NOT_FOUND|EADDRINUSE|ECONNREFUSED)(?:['"]|\])?/
const TS_ERROR = /^(.*?)(?:(?:\((\d+),(\d+)\))|(?::(\d+):(\d+)))\s*(?:-|:)\s*error\s+(TS\d+)\s*:\s*(.+)$/i

export const DEFAULT_PARSERS: readonly LogErrorParser[] = [
  typescriptParser(),
  nodeParser(),
  springParser(),
  javaParser(),
  genericParser(),
].sort((a, b) => b.priority - a.priority)

export function parseErrorBlock(block: ErrorBlock, context: ParseContext = {}, parsers: readonly LogErrorParser[] = DEFAULT_PARSERS): ParsedError {
  for (const parser of parsers) {
    if (!parser.supports(block, context)) continue
    const parsed = parser.parse(block, context)
    if (parsed) return { ...parsed, parserId: parser.id }
  }
  return fallbackParsed(block, context, 'generic')
}

function typescriptParser(): LogErrorParser {
  return {
    id: 'typescript', priority: 500,
    supports: (block) => block.rule.category === 'TYPESCRIPT_COMPILE' || block.lines.some((line) => /\berror\s+TS\d+\s*:/i.test(line)),
    parse: (block, context) => {
      const lines = cleanLines(block)
      const match = lines.map((line) => line.match(TS_ERROR)).find(Boolean)
      const fallback = lines.join(' ').match(/\b(TS\d+)\s*:\s*(.+)/i)
      const errorCode = match?.[6]?.toUpperCase() ?? fallback?.[1]?.toUpperCase()
      const summary = match?.[7]?.trim() ?? fallback?.[2]?.trim() ?? lines.find(Boolean) ?? 'TypeScript compilation failed'
      const file = match?.[1]?.trim()
      const line = Number(match?.[2] ?? match?.[4]) || undefined
      const column = Number(match?.[3] ?? match?.[5]) || undefined
      return {
        category: 'TYPESCRIPT_COMPILE', language: 'typescript', runtime: 'node', toolchain: detectToolchain(context.command) ?? 'typescript',
        exceptionType: errorCode ?? 'TypeScriptError', ...(errorCode ? { errorCode } : {}), summary, rootMessage: summary,
        ...(file ? { file } : {}), ...(line ? { line } : {}), ...(column ? { column } : {}), exceptionChain: [errorCode ?? 'TypeScriptError'], rawContext: lines,
      }
    },
  }
}

function nodeParser(): LogErrorParser {
  return {
    id: 'node', priority: 400,
    supports: (block) => ['NODE_RUNTIME', 'MODULE_RESOLUTION', 'BUILD_FAILURE'].includes(block.rule.category)
      || block.rule.language === 'javascript' || block.rule.language === 'typescript'
      || block.lines.some((line) => NODE_ERROR.test(line) || /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|EADDRINUSE|ECONNREFUSED/.test(line)),
    parse: (block, context) => {
      const lines = cleanLines(block)
      const text = lines.join('\n')
      const errorMatch = lines.map((line) => line.match(NODE_ERROR)).find(Boolean)
      const code = lines.map((line) => line.match(NODE_CODE)?.[1]).find(Boolean)
        ?? text.match(/\b(MODULE_NOT_FOUND|EADDRINUSE|ECONNREFUSED)\b/)?.[1]
      const missing = text.match(/Cannot find (?:module|package)\s+['"]([^'"]+)['"]/i)?.[1]
        ?? text.match(/Cannot find (?:module|package)\s+([^\s]+)/i)?.[1]
      const category: ErrorCategory = code === 'EADDRINUSE' || /address already in use/i.test(text) ? 'APPLICATION_STARTUP'
        : code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND' || missing ? 'MODULE_RESOLUTION'
          : block.rule.category === 'BUILD_FAILURE' || /Module build failed|Failed to compile|ELIFECYCLE|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL|(?:vite|rollup|webpack|next).*(?:error|failed)/i.test(text) ? 'BUILD_FAILURE'
            : 'NODE_RUNTIME'
      const frame = firstBusinessNodeFrame(lines)
      const toolchain = detectToolchain(context.command) ?? inferredToolchain(text)
      const language: RuntimeLanguage = toolchain === 'typescript' || /\.(?:ts|tsx)(?::\d+|\b)/i.test(frame?.file ?? text) ? 'typescript' : 'javascript'
      const exceptionType = code ?? errorMatch?.[1] ?? (category === 'MODULE_RESOLUTION' ? 'ModuleResolutionError' : category === 'BUILD_FAILURE' ? 'BuildError' : 'NodeError')
      const rootMessage = missing ? `Cannot find module ${missing}` : nodeRootMessage(lines, errorMatch?.[2], code)
      const summary = rootMessage ?? lines.find((line) => /error|failed/i.test(line))?.trim() ?? exceptionType
      return {
        category, language, runtime: 'node', toolchain, exceptionType, ...(code ? { errorCode: code } : {}), summary,
        ...(rootMessage ? { rootMessage } : {}), ...(missing ? { target: missing } : {}),
        ...(frame?.file ? { file: frame.file } : {}), ...(frame?.line ? { line: frame.line } : {}), ...(frame?.column ? { column: frame.column } : {}), ...(frame?.symbol ? { symbol: frame.symbol } : {}),
        ...extractNodePort(text), exceptionChain: dedupe([errorMatch?.[1], code, exceptionType].filter((value): value is string => Boolean(value))), rawContext: lines,
      }
    },
  }
}

function springParser(): LogErrorParser {
  return {
    id: 'spring', priority: 300,
    supports: (block) => block.rule.framework === 'spring' && block.rule.category !== 'JAVA_RUNTIME',
    parse: (block) => parseJava(block),
  }
}

function javaParser(): LogErrorParser {
  return {
    id: 'java', priority: 200,
    supports: (block) => block.rule.language === 'java' || block.lines.some((line) => JAVA_EXCEPTION.test(line) || /APPLICATION FAILED TO START/.test(line)),
    parse: (block) => parseJava(block),
  }
}

function genericParser(): LogErrorParser {
  return { id: 'generic', priority: 0, supports: () => true, parse: (block, context) => fallbackParsed(block, context, 'generic') }
}

function parseJava(block: ErrorBlock): ParsedError {
  const lines = cleanLines(block)
  const chain: Array<{ type: string; message?: string }> = []
  for (const line of lines) {
    const matched = line.trim().match(JAVA_EXCEPTION)
    if (matched?.[1]) chain.push({ type: matched[1], ...(matched[2]?.trim() ? { message: matched[2].trim() } : {}) })
  }
  const category = classifyJava(lines.join('\n'), block.rule.category)
  const deepest = chain.at(-1)
  const preferred = preferredJavaException(category, chain.map((item) => item.type)) ?? chain[0]?.type ?? fallbackJavaType(category, lines)
  const preferredEntry = chain.find((item) => item.type === preferred)
  const rootMessage = extractJavaRootMessage(lines, deepest?.message ?? preferredEntry?.message)
  const frame = lines.map((line) => line.match(JAVA_FRAME)).find(Boolean)
  const symbol = extractJavaSymbol(lines, category)
  const target = lines.join(' ').match(/(?:connect to|at)\s+((?:localhost|[\w.-]+):\d+)/i)?.[1]
  const port = extractPort(lines.join(' '))
  return {
    category, framework: category === 'JAVA_RUNTIME' || category === 'UNKNOWN' ? 'java' : 'spring', language: 'java', runtime: 'jvm', ...(block.rule.toolchain ? { toolchain: block.rule.toolchain } : {}),
    exceptionType: preferred, summary: summarizeJava(category, preferred, rootMessage, lines), ...(rootMessage ? { rootMessage } : {}), ...(target ? { target } : {}),
    ...(frame?.[3] ? { file: frame[3] } : {}), ...(frame?.[4] ? { line: Number(frame[4]) } : {}),
    ...(symbol ? { symbol } : frame?.[1] && frame[2] ? { symbol: `${frame[1]}.${frame[2]}` } : {}), ...(port ? { port } : {}),
    exceptionChain: dedupe(chain.map((item) => item.type)), rawContext: lines,
  }
}

function fallbackParsed(block: ErrorBlock, context: ParseContext, parserId: string): ParsedError {
  const lines = cleanLines(block)
  const first = lines.find((line) => /error|failed|exception/i.test(line))?.trim() ?? lines.find(Boolean)?.trim() ?? 'Process failed'
  const toolchain = detectToolchain(context.command) ?? block.rule.toolchain
  const node = toolchain && ['node', 'npm', 'pnpm', 'yarn', 'typescript', 'vite', 'rollup', 'webpack', 'next', 'vitest', 'jest'].includes(toolchain)
  return { category: block.rule.category, language: node ? 'javascript' : block.rule.language ?? 'unknown', runtime: node ? 'node' : 'unknown', ...(toolchain ? { toolchain } : {}), parserId, exceptionType: 'RuntimeError', summary: first, rootMessage: first, exceptionChain: ['RuntimeError'], rawContext: lines }
}

function firstBusinessNodeFrame(lines: string[]): { symbol?: string; file: string; line: number; column: number } | undefined {
  const frames: Array<{ symbol?: string; file: string; line: number; column: number }> = []
  for (const raw of lines) {
    const line = raw.trim()
    const withSymbol = line.match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/)
    const bare = line.match(/^at\s+(.+):(\d+):(\d+)$/)
    const file = (withSymbol?.[2] ?? bare?.[1])?.replace(/^file:\/\//, '')
    const row = Number(withSymbol?.[3] ?? bare?.[2])
    const column = Number(withSymbol?.[4] ?? bare?.[3])
    if (file && row && column) frames.push({ ...(withSymbol?.[1] ? { symbol: withSymbol[1] } : {}), file, line: row, column })
  }
  return frames.find((frame) => !/(?:^|[\\/])node_modules[\\/]|(?:^|[\\/])node:internal|^node:internal|[\\/]internal[\\/]/i.test(frame.file)) ?? frames[0]
}

function nodeRootMessage(lines: string[], candidate?: string, code?: string): string | undefined {
  if (code === 'EADDRINUSE') return 'Address already in use'
  if (code === 'ECONNREFUSED' || lines.some((line) => /ECONNREFUSED|Connection refused/i.test(line))) return 'Connection refused'
  return candidate?.trim() || lines.find((line) => /^(?:Error|\w+Error)(?:\s*\[[^\]]+\])?:/i.test(line.trim()))?.trim()
}

function extractNodePort(text: string): { port?: number; target?: string } {
  const address = text.match(/(?:address|listen|connect)\s*(?::|=)?\s*['"]?((?:localhost|[\w.:-]+))['"]?/i)?.[1]
  const portText = text.match(/(?:port\s*(?::|=)?\s*|:)(\d{2,5})\b/i)?.[1]
  const port = portText ? Number(portText) : undefined
  return { ...(port ? { port } : {}), ...(address && address !== '::' ? { target: address } : {}) }
}

function inferredToolchain(text: string): Toolchain {
  if (/vite/i.test(text)) return 'vite'
  if (/rollup/i.test(text)) return 'rollup'
  if (/webpack/i.test(text)) return 'webpack'
  if (/next(?:\.js)?/i.test(text)) return 'next'
  if (/pnpm/i.test(text)) return 'pnpm'
  if (/npm/i.test(text)) return 'npm'
  if (/yarn/i.test(text)) return 'yarn'
  return 'node'
}

function classifyJava(text: string, fallback: ErrorCategory): ErrorCategory {
  if (/BindingException|Invalid bound statement|org\.apache\.ibatis|ReflectionException/.test(text)) return 'MYBATIS'
  if (/Redis|lettuce|localhost:6379/.test(text)) return 'REDIS'
  if (/SQLSyntaxError|CommunicationsException|DuplicateKey|DataIntegrityViolation/.test(text)) return 'DATABASE'
  if (/APPLICATION FAILED TO START|Port \d+ was already in use|Web server failed to start/.test(text)) return 'APPLICATION_STARTUP'
  if (/BeanCreation|UnsatisfiedDependency|NoSuchBeanDefinition|ApplicationContext/.test(text)) return 'SPRING_IOC'
  if (/MethodArgumentTypeMismatch|HttpMessageNotReadable|MissingServletRequestParameter/.test(text)) return 'HTTP'
  if (/NullPointer|IllegalArgument|ClassCast|NumberFormat/.test(text)) return 'JAVA_RUNTIME'
  return fallback
}

function preferredJavaException(category: ErrorCategory, chain: string[]): string | undefined {
  if (category === 'REDIS') return chain.find((type) => type === 'RedisConnectionFailureException') ?? chain.find((type) => type.includes('Redis'))
  if (category === 'MYBATIS') return chain.find((type) => type === 'BindingException') ?? chain.find((type) => type.includes('Persistence'))
  if (category === 'APPLICATION_STARTUP') return 'PortAlreadyInUseError'
  return chain.at(-1)
}

function fallbackJavaType(category: ErrorCategory, lines: string[]): string {
  if (category === 'APPLICATION_STARTUP' && lines.some((line) => /Port \d+ was already in use/.test(line))) return 'PortAlreadyInUseError'
  return 'RuntimeError'
}

function extractJavaRootMessage(lines: string[], candidate?: string): string | undefined {
  if (lines.some((line) => /Connection refused/i.test(line))) return 'Connection refused'
  const npe = lines.join(' ').match(/because\s+"([^"]+)"\s+is null/i)
  if (npe?.[1]) return `${npe[1]} is null`
  if (lines.some((line) => /Invalid bound statement/i.test(line))) return 'Invalid bound statement'
  const port = extractPort(lines.join(' '))
  if (port) return `Port ${port} already in use`
  return candidate?.trim() || undefined
}

function extractJavaSymbol(lines: string[], category: ErrorCategory): string | undefined {
  if (category !== 'MYBATIS') return undefined
  const text = lines.join(' ')
  const statement = text.match(/Invalid bound statement(?:\s*\(not found\))?\s*:\s*((?:[\w$]+\.)+[\w$]+)/i)?.[1]
  if (statement) return statement.split('.').slice(-2).join('.')
  const mapper = text.match(/((?:[A-Za-z_$][\w$]*\.)+[A-Z][\w$]*Mapper\.[\w$]+)/)?.[1]
  return mapper ? mapper.split('.').slice(-2).join('.') : undefined
}

function summarizeJava(category: ErrorCategory, type: string, root: string | undefined, lines: string[]): string {
  if (category === 'MYBATIS') return root ?? 'MyBatis could not find the mapped statement'
  if (category === 'REDIS') return root ?? 'Redis connection failed'
  if (category === 'APPLICATION_STARTUP') return root ?? 'Application failed to start'
  return root ?? lines.find((line) => line.trim())?.trim() ?? type
}

function extractPort(text: string): number | undefined {
  const value = text.match(/Port\s+(\d+)\s+(?:was already in use|already in use)/i)?.[1]
  return value ? Number(value) : undefined
}

function cleanLines(block: ErrorBlock): string[] { return block.lines.map((line) => line.trimEnd()) }
function dedupe(values: string[]): string[] { return [...new Set(values)] }
