import { describe, expect, it } from 'vitest'
import { ErrorBlockCollector, parseErrorBlock } from '../src/core/index.js'

function parse(text: string, command = 'node app.js', chunks = [text]) {
  const collector = new ErrorBlockCollector()
  const blocks = chunks.flatMap((chunk) => collector.push(chunk)).concat(collector.finish())
  return blocks.map((block) => parseErrorBlock(block, { command, captureMode: 'tool-result' }))
}

const cases = [
  ['TypeError unix', 'TypeError: value is not a function\n    at run (/work/src/app.js:12:8)\n', 'NODE_RUNTIME', 'TypeError'],
  ['TypeError windows', 'TypeError: value is null\n    at run (C:\\repo\\src\\app.js:4:9)\n', 'NODE_RUNTIME', 'TypeError'],
  ['ReferenceError', 'ReferenceError: config is not defined\n    at main (/repo/app.js:2:1)\n', 'NODE_RUNTIME', 'ReferenceError'],
  ['SyntaxError', 'SyntaxError: Unexpected token }\n    at /repo/app.js:3:7\n', 'NODE_RUNTIME', 'SyntaxError'],
  ['RangeError', 'RangeError: Maximum call stack size exceeded\n    at recurse (/repo/src/a.js:1:1)\n', 'NODE_RUNTIME', 'RangeError'],
  ['promise rejection', 'UnhandledPromiseRejectionWarning: Error: rejected\n    at main (/repo/src/a.js:8:2)\n', 'NODE_RUNTIME', 'UnhandledPromiseRejectionWarning'],
  ['commonjs module', "Error: Cannot find module 'left-pad'\n    at Function._resolveFilename (node:internal/modules/cjs/loader:1:1)\n  code: 'MODULE_NOT_FOUND'\n", 'MODULE_RESOLUTION', 'MODULE_NOT_FOUND'],
  ['esm module', "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'kleur' imported from /repo/app.mjs\n    at packageResolve (node:internal/modules/esm/resolve:1:1)\n  code: 'ERR_MODULE_NOT_FOUND'\n", 'MODULE_RESOLUTION', 'ERR_MODULE_NOT_FOUND'],
  ['port occupied', "Error: listen EADDRINUSE: address already in use :::3000\n    at Server.setupListenHandle (node:net:1:1)\n  code: 'EADDRINUSE'\n  port: 3000\n", 'APPLICATION_STARTUP', 'EADDRINUSE'],
  ['connection refused', "Error: connect ECONNREFUSED 127.0.0.1:6379\n    at TCPConnectWrap.afterConnect (node:net:1:1)\n", 'NODE_RUNTIME', 'ECONNREFUSED'],
  ['TS2322 parens', "src/main.ts(4,7): error TS2322: Type 'string' is not assignable to type 'number'.\n", 'TYPESCRIPT_COMPILE', 'TS2322'],
  ['TS2307 colon', "src/main.ts:2:20 - error TS2307: Cannot find module './missing'.\n", 'TYPESCRIPT_COMPILE', 'TS2307'],
  ['TS2345', "src/main.ts(9,4): error TS2345: Argument of type 'string' is not assignable.\n", 'TYPESCRIPT_COMPILE', 'TS2345'],
  ['TS2339', "src/main.ts(3,8): error TS2339: Property 'name' does not exist on type '{}'.\n", 'TYPESCRIPT_COMPILE', 'TS2339'],
  ['TS2554', 'src/main.ts(5,1): error TS2554: Expected 2 arguments, but got 1.\n', 'TYPESCRIPT_COMPILE', 'TS2554'],
  ['vite build', 'vite v6 building\nerror during build:\nRollupError: Could not resolve entry module "src/missing.ts".\n', 'BUILD_FAILURE', 'BuildError'],
  ['rollup build', 'RollupError: Could not resolve "./missing" from "src/main.ts"\n', 'BUILD_FAILURE', 'BuildError'],
  ['webpack build', 'Module build failed (from ./node_modules/loader.js):\nSyntaxError: Unexpected token\n', 'BUILD_FAILURE', 'BuildError'],
  ['next build', 'Next.js build error: Failed to compile\nTypeError: route is undefined\n', 'BUILD_FAILURE', 'BuildError'],
  ['pnpm lifecycle', 'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL app@build: `vite build`\nError: Build failed with 1 error\n', 'BUILD_FAILURE', 'BuildError'],
] as const

describe('Node.js and TypeScript parsers', () => {
  it.each(cases)('parses %s', (_name, text, category, exceptionType) => {
    const event = parse(text, /TS\d+/.test(text) ? 'pnpm exec tsc' : 'node app.js')[0]
    expect(event).toMatchObject({ category, exceptionType, runtime: 'node' })
  })

  it('selects the first business frame and extracts line and column', () => {
    const event = parse('TypeError: bad\n    at loader (node:internal/modules/cjs:1:1)\n    at run (/repo/src/app.ts:18:6)\n', 'tsx src/app.ts')[0]
    expect(event).toMatchObject({ language: 'typescript', file: '/repo/src/app.ts', line: 18, column: 6, symbol: 'run' })
  })

  it('survives arbitrary chunks, CRLF, and ANSI', () => {
    const input = '\u001b[31mTypeError: broken\r\n    at run (C:\\repo\\src\\app.js:7:3)\r\n\u001b[0m'
    for (let index = 1; index < input.length; index += 5) expect(parse(input, 'node app.js', [input.slice(0, index), input.slice(index)])[0]).toMatchObject({ exceptionType: 'TypeError', file: 'C:\\repo\\src\\app.js', line: 7, column: 3 })
  })
})
