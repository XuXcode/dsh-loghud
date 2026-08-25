import { describe, expect, it } from 'vitest'
import { ErrorBlockCollector, parseErrorBlock } from '../src/core/index.js'
import { fixtures } from './fixtures.js'

function parse(text: string, chunks = [text]) {
  const collector = new ErrorBlockCollector()
  const blocks = chunks.flatMap((chunk) => collector.push(chunk)).concat(collector.finish())
  return blocks.map((block) => parseErrorBlock(block))
}

describe('collector and parser', () => {
  it.each([
    ['redis', 'REDIS', 'RedisConnectionFailureException'],
    ['mybatis', 'MYBATIS', 'BindingException'],
    ['bean', 'SPRING_IOC', 'IllegalStateException'],
    ['npe', 'JAVA_RUNTIME', 'NullPointerException'],
    ['port', 'APPLICATION_STARTUP', 'PortAlreadyInUseError'],
    ['mysql', 'DATABASE', 'SQLSyntaxErrorException'],
    ['mvc', 'HTTP', 'MissingServletRequestParameterException'],
  ] as const)('parses %s', (key, category, exceptionType) => {
    const event = parse(fixtures[key])[0]!
    expect(event.category).toBe(category)
    expect(event.exceptionType).toBe(exceptionType)
  })

  it('survives every chunk boundary, CRLF, and ANSI', () => {
    const input = `\u001b[31m${fixtures.npe.replaceAll('\n', '\r\n')}\u001b[0m`
    const one = parse(input)[0]
    for (let point = 1; point < input.length; point += 7) {
      expect(parse(input, [input.slice(0, point), input.slice(point)])[0]?.rawContext).toEqual(one?.rawContext)
      expect(parse(input, [input.slice(0, point), input.slice(point)])[0]?.exceptionType).toBe('NullPointerException')
    }
  })

  it('separates adjacent top-level exceptions', () => expect(parse(`${fixtures.npe}${fixtures.mybatis}`)).toHaveLength(2))
  it('ignores normal log noise', () => expect(parse(Array.from({ length: 1000 }, (_, i) => `INFO request ${i}\n`).join(''))).toEqual([]))
  it('bounds an oversized block', () => {
    const collector = new ErrorBlockCollector({ maxLines: 20, normalBoundaryLines: 100 })
    const blocks = collector.push(`java.lang.NullPointerException: x\n${'\tat a.B.m(B.java:1)\n'.repeat(100)}`).concat(collector.finish())
    expect(blocks[0]?.lines.length).toBeLessThanOrEqual(20)
  })
  it('extracts file, line, symbol, port and mapper target', () => {
    expect(parse(fixtures.npe)[0]).toMatchObject({ file: 'UserService.java', line: 27, symbol: 'UserService.load' })
    expect(parse(fixtures.port)[0]).toMatchObject({ port: 8080 })
    expect(parse(fixtures.mybatis)[0]?.symbol).toContain('UserMapper.findById')
  })
})
