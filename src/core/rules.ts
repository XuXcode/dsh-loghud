import type { ErrorDetectionRule } from '../shared/types.js'

export const DEFAULT_RULES: readonly ErrorDetectionRule[] = [
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

function rule(id: string, category: ErrorDetectionRule['category'], ...patterns: RegExp[]): ErrorDetectionRule {
  return { id, ...(category === 'UNKNOWN' ? {} : { framework: 'spring' }), category, severity: 'error', startPatterns: patterns }
}

const cheapNeedles = ['exception', 'error', 'failed', 'failure', 'caused by', 'connection refused', 'invalid bound', 'already in use', 'exited with code']

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
