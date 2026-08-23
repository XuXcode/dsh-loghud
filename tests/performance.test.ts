import { expect, it } from 'vitest'
import { ErrorStore, LogProcessor } from '../src/core/index.js'
import { fixtures } from './fixtures.js'

it('handles 100,000 normal lines and high-frequency repeats with bounded state', () => {
  const store = new ErrorStore(); const processor = new LogProcessor(store)
  const normal = Array.from({ length: 100_000 }, (_, index) => `INFO request=${index} completed\n`).join('')
  processor.finish('s', normal, { command: 'mvn spring-boot:run', captureMode: 'tool-result', exitCode: 0 })
  for (let index = 0; index < 250; index++) processor.finish('s', fixtures.redis, { command: 'java -jar app.jar', captureMode: 'tool-result', exitCode: 1 })
  const snapshot = store.snapshot('s')
  expect(snapshot.active).toHaveLength(1)
  expect(snapshot.active[0]?.occurrences).toBe(250)
  expect(snapshot.active[0]?.rawContext.length).toBeLessThanOrEqual(120)
})
