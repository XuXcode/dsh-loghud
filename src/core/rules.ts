import type { ErrorDetectionRule } from '../shared/types.js'

export const DEFAULT_RULES: readonly ErrorDetectionRule[] = [
  rule('typescript', 'TYPESCRIPT_COMPILE', { language: 'typescript', toolchain: 'typescript' }, /\berror\s+TS\d+\s*:/i),
  rule('node-module', 'MODULE_RESOLUTION', { language: 'javascript', toolchain: 'node' }, /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Cannot find (?:module|package)/i),
  rule('node-startup', 'APPLICATION_STARTUP', { language: 'javascript', toolchain: 'node' }, /EADDRINUSE|address already in use/i),
  rule('node-network', 'NODE_RUNTIME', { language: 'javascript', toolchain: 'node' }, /ECONNREFUSED|ECONNRESET|ETIMEDOUT/i),
  rule('node-runtime', 'NODE_RUNTIME', { language: 'javascript', toolchain: 'node' }, /(?:Type|Reference|Syntax|Range|URI|Eval|Aggregate)Error\s*:|UnhandledPromiseRejection/i),
  rule('node-build', 'BUILD_FAILURE', { language: 'typescript', toolchain: 'node' }, /(?:vite|rollup|webpack|next).*(?:error|failed)|Module build failed|Failed to compile|ELIFECYCLE|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL/i),
  rule('python-location', 'PYTHON_RUNTIME', { language: 'python', toolchain: 'python' }, /^\s*File ["'].+\.py["'], line \d+/i),
  rule('python-traceback', 'PYTHON_RUNTIME', { language: 'python', toolchain: 'python' }, /Traceback \(most recent call last\):/i),
  rule('python-import', 'PYTHON_IMPORT', { language: 'python', toolchain: 'python' }, /(?:ModuleNotFoundError|ImportError):/i),
  rule('python-test', 'PYTHON_TEST_FAILURE', { language: 'python', toolchain: 'pytest' }, /(?:^|\s)(?:FAILED|ERROR)\s+.+\.py|^E\s+(?:[\w.]+)?(?:AssertionError|\w+Error):|^.+\.py:\d+(?::\d+)?:\s*(?:AssertionError|\w+Error)/i),
  rule('python-async', 'PYTHON_RUNTIME', { language: 'python', toolchain: 'python' }, /Task exception was never retrieved|Future exception was never retrieved/i),
  rule('spring-ioc', 'SPRING_IOC', /(?:BeanCreation|UnsatisfiedDependency|NoSuchBeanDefinition|ApplicationContext)Exception/),
  rule('mybatis', 'MYBATIS', /(?:Binding|Reflection|Persistence)Exception|Invalid bound statement/),
  rule('database', 'DATABASE', /SQLSyntaxErrorException|CommunicationsException|DuplicateKeyException|DataIntegrityViolationException/),
  rule('redis', 'REDIS', /RedisConnectionFailureException|RedisSystemException|RedisConnectionException|Connection refused/),
  rule('http', 'HTTP', /MethodArgumentTypeMismatchException|HttpMessageNotReadableException|MissingServletRequestParameterException/),
  rule('java-runtime', 'JAVA_RUNTIME', /NullPointerException|IllegalArgumentException|ClassCastException|NumberFormatException/),
  rule('startup', 'APPLICATION_STARTUP', /APPLICATION FAILED TO START|Application run failed|Web server failed to start|Port \d+ was already in use|Failed to start/),
  rule('generic-exception', 'UNKNOWN', /(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*(?:Exception|Error)(?::|\b)|Caused by:/),
  rule('process-failure', 'UNKNOWN', /Process exited with code [1-9]\d*|Connection refused/),
]

function rule(id: string, category: ErrorDetectionRule['category'], ...input: Array<RegExp | Pick<ErrorDetectionRule, 'language' | 'toolchain'>>): ErrorDetectionRule {
  const metadata = input.find((value): value is Pick<ErrorDetectionRule, 'language' | 'toolchain'> => !(value instanceof RegExp))
  const patterns = input.filter((value): value is RegExp => value instanceof RegExp)
  const javaFamily = !metadata && category !== 'UNKNOWN'
  return { id, ...(javaFamily ? { framework: 'spring', language: 'java' as const } : {}), ...metadata, category, severity: 'error', startPatterns: patterns }
}

const cheapNeedles = ['exception', 'error', 'failed', 'failure', 'traceback', 'file "', "file '", 'caused by', 'connection refused', 'invalid bound', 'already in use', 'exited with code', 'cannot find module', 'cannot find package', 'eaddrinuse', 'econnrefused', 'elifecycle', 'err_pnpm']

export function mightContainError(line: string): boolean {
  const lower = line.toLowerCase()
  return cheapNeedles.some((needle) => lower.includes(needle))
}

export function matchRule(line: string, rules: readonly ErrorDetectionRule[] = DEFAULT_RULES): ErrorDetectionRule | undefined {
  if (!mightContainError(line)) return undefined
  return rules.find((candidate) => candidate.startPatterns.some((pattern) => resetTest(pattern, line)))
}

function resetTest(pattern: RegExp, line: string): boolean {
  pattern.lastIndex = 0
  return pattern.test(line)
}
