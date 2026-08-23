import type { ErrorCategory, ParsedError } from '../shared/types.js'
import type { ErrorBlock } from './block-collector.js'

const EXCEPTION = /(?:^|Caused by:\s*|Suppressed:\s*)(?:[\w$]+\.)*([A-Za-z_$][\w$]*(?:Exception|Error))(?::\s*(.*))?/
const FRAME = /\bat\s+(?:[\w$]+\.)*([\w$]+)\.([\w$<>]+)\(([^():]+):(\d+)\)/

export function parseErrorBlock(block: ErrorBlock): ParsedError {
  const lines = block.lines.map((line) => line.trimEnd())
  const chain: Array<{ type: string; message?: string }> = []
  for (const line of lines) {
    const matched = line.trim().match(EXCEPTION)
    if (matched?.[1]) chain.push({ type: matched[1], ...(matched[2]?.trim() ? { message: matched[2].trim() } : {}) })
  }

  const category = classify(lines.join('\n'), block.rule.category)
  const outer = chain[0]
  const deepest = chain.at(-1)
  const preferred = preferredException(category, chain.map((item) => item.type)) ?? outer?.type ?? fallbackType(category, lines)
  const preferredEntry = chain.find((item) => item.type === preferred)
  const rootMessage = extractRootMessage(lines, deepest?.message ?? preferredEntry?.message)
  const frame = lines.map((line) => line.match(FRAME)).find(Boolean)
  const symbol = extractSymbol(lines, category)
  const target = extractTarget(lines)
  const port = extractPort(lines)
  const summary = summarize(category, preferred, rootMessage, lines)

  return {
    category,
    framework: category === 'JAVA_RUNTIME' || category === 'UNKNOWN' ? 'java' : 'spring',
    exceptionType: preferred,
    summary,
    ...(rootMessage ? { rootMessage } : {}),
    ...(target ? { target } : {}),
    ...(frame?.[3] ? { file: frame[3] } : {}),
    ...(frame?.[4] ? { line: Number(frame[4]) } : {}),
    ...(symbol ? { symbol } : frame?.[1] && frame[2] ? { symbol: `${frame[1]}.${frame[2]}` } : {}),
    ...(port ? { port } : {}),
    exceptionChain: dedupe(chain.map((item) => item.type)),
    rawContext: lines,
  }
}

function classify(text: string, fallback: ErrorCategory): ErrorCategory {
  if (/BindingException|Invalid bound statement|org\.apache\.ibatis|ReflectionException/.test(text)) return 'MYBATIS'
  if (/Redis|lettuce|localhost:6379/.test(text)) return 'REDIS'
  if (/SQLSyntaxError|CommunicationsException|DuplicateKey|DataIntegrityViolation/.test(text)) return 'DATABASE'
  if (/APPLICATION FAILED TO START|Port \d+ was already in use|Web server failed to start/.test(text)) return 'APPLICATION_STARTUP'
  if (/BeanCreation|UnsatisfiedDependency|NoSuchBeanDefinition|ApplicationContext/.test(text)) return 'SPRING_IOC'
  if (/MethodArgumentTypeMismatch|HttpMessageNotReadable|MissingServletRequestParameter/.test(text)) return 'HTTP'
  if (/NullPointer|IllegalArgument|ClassCast|NumberFormat/.test(text)) return 'JAVA_RUNTIME'
  return fallback
}

function preferredException(category: ErrorCategory, chain: string[]): string | undefined {
  if (category === 'REDIS') return chain.find((type) => type === 'RedisConnectionFailureException') ?? chain.find((type) => type.includes('Redis'))
  if (category === 'MYBATIS') return chain.find((type) => type === 'BindingException') ?? chain.find((type) => type.includes('Persistence'))
  if (category === 'APPLICATION_STARTUP') return 'PortAlreadyInUseError'
  return chain.at(-1)
}

function fallbackType(category: ErrorCategory, lines: string[]): string {
  if (category === 'APPLICATION_STARTUP' && lines.some((line) => /Port \d+ was already in use/.test(line))) return 'PortAlreadyInUseError'
  return 'RuntimeError'
}

function extractRootMessage(lines: string[], candidate?: string): string | undefined {
  if (lines.some((line) => /Connection refused/i.test(line))) return 'Connection refused'
  const npe = lines.join(' ').match(/because\s+"([^"]+)"\s+is null/i)
  if (npe?.[1]) return `${npe[1]} is null`
  if (lines.some((line) => /Invalid bound statement/i.test(line))) return 'Invalid bound statement'
  const port = lines.join(' ').match(/Port\s+(\d+)\s+was already in use/i)
  if (port?.[1]) return `Port ${port[1]} already in use`
  return candidate?.replace(/^\s+|\s+$/g, '') || undefined
}

function extractSymbol(lines: string[], category: ErrorCategory): string | undefined {
  if (category !== 'MYBATIS') return undefined
  const text = lines.join(' ')
  const statement = text.match(/Invalid bound statement(?:\s*\(not found\))?\s*:\s*((?:[\w$]+\.)+[\w$]+)/i)?.[1]
  if (statement) return statement.split('.').slice(-2).join('.')
  const mapper = text.match(/((?:[A-Za-z_$][\w$]*\.)+[A-Z][\w$]*Mapper\.[\w$]+)/)?.[1]
  return mapper ? mapper.split('.').slice(-2).join('.') : undefined
}

function extractTarget(lines: string[]): string | undefined {
  return lines.join(' ').match(/(?:connect to|at)\s+((?:localhost|[\w.-]+):\d+)/i)?.[1]
}

function extractPort(lines: string[]): number | undefined {
  const value = lines.join(' ').match(/Port\s+(\d+)\s+(?:was already in use|already in use)/i)?.[1]
  return value ? Number(value) : undefined
}

function summarize(category: ErrorCategory, type: string, root: string | undefined, lines: string[]): string {
  if (category === 'MYBATIS') return root ?? 'MyBatis could not find the mapped statement'
  if (category === 'REDIS') return root ?? 'Redis connection failed'
  if (category === 'APPLICATION_STARTUP') return root ?? 'Application failed to start'
  return root ?? lines.find((line) => line.trim())?.trim() ?? type
}

function dedupe(values: string[]): string[] { return [...new Set(values)] }
