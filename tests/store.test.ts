import { describe, expect, it } from 'vitest'
import { ErrorStore, LogProcessor } from '../src/core/index.js'
import { fixtures } from './fixtures.js'

describe('session store', () => {
  it('starts UNKNOWN, becomes HEALTHY, and becomes BROKEN', () => {
    const store = new ErrorStore(); const processor = new LogProcessor(store)
    expect(store.snapshot('s').health).toBe('UNKNOWN')
    processor.finish('s', 'Started DemoApplication in 1.2 seconds\n', { command: 'mvn spring-boot:run', captureMode: 'tool-result', exitCode: 0 })
    expect(store.snapshot('s').health).toBe('HEALTHY')
    processor.finish('s', fixtures.npe, { command: 'mvn spring-boot:run', captureMode: 'tool-result', exitCode: 1 })
    expect(store.snapshot('s').health).toBe('BROKEN')
  })

  it('deduplicates five occurrences into one versioned card', () => {
    const store = new ErrorStore(); const processor = new LogProcessor(store)
    for (let i = 0; i < 5; i++) processor.finish('s', fixtures.redis, { command: 'java -jar app.jar', captureMode: 'tool-result', exitCode: 1 })
    expect(store.snapshot('s').active).toHaveLength(1)
    expect(store.snapshot('s').active[0]).toMatchObject({ occurrences: 5, version: 5 })
  })

  it('isolates sessions and supports manual lifecycle actions', () => {
    const store = new ErrorStore(); const processor = new LogProcessor(store)
    processor.finish('a', fixtures.npe, { captureMode: 'tool-result' })
    expect(store.snapshot('b').active).toHaveLength(0)
    const fingerprint = store.snapshot('a').active[0]!.fingerprint
    expect(store.resolve('a', fingerprint)).toBe(true)
    expect(store.snapshot('a').resolved).toHaveLength(1)
    store.clearResolved('a'); expect(store.snapshot('a').resolved).toHaveLength(0)
    store.clearAll('a'); expect(store.snapshot('a').health).toBe('UNKNOWN')
  })

  it('automatically resolves only matching Spring startup command families', () => {
    const store = new ErrorStore(); const processor = new LogProcessor(store)
    processor.finish('s', fixtures.port, { command: './mvnw spring-boot:run', captureMode: 'tool-result', exitCode: 1 })
    processor.finish('s', 'Started DemoApplication in 1.0 seconds\n', { command: 'mvn spring-boot:run', captureMode: 'tool-result', exitCode: 0 })
    expect(store.snapshot('s').active).toHaveLength(0)
    expect(store.snapshot('s').resolved).toHaveLength(1)
  })

  it('enforces the resolved-history limit', () => {
    const store = new ErrorStore({ maxResolvedHistory: 2 }); const processor = new LogProcessor(store)
    for (const text of [fixtures.npe, fixtures.mybatis, fixtures.redis]) {
      processor.finish('s', text, { captureMode: 'tool-result' })
      store.resolve('s', store.snapshot('s').active[0]!.fingerprint)
    }
    expect(store.snapshot('s').resolved).toHaveLength(2)
  })

  it('restores bounded persisted snapshots and publishes global changes', () => {
    const source = new ErrorStore(); new LogProcessor(source).finish('s', fixtures.npe, { captureMode: 'tool-result' })
    const restored = new ErrorStore({ maxErrorContextLines: 10 }); restored.restore(source.snapshot('s'))
    expect(restored.snapshot('s').active[0]?.exceptionType).toBe('NullPointerException')
    let published = 0; const dispose = restored.subscribeAll(() => { published++ })
    restored.resolve('s', restored.snapshot('s').active[0]!.fingerprint)
    expect(published).toBe(1); dispose()
  })

  it('validates and clamps runtime settings', () => {
    const store = new ErrorStore({ maxErrorContextLines: -20, maxResolvedHistory: 9999 })
    expect(store.settings.maxErrorContextLines).toBe(10)
    expect(store.settings.maxResolvedHistory).toBe(500)
  })
})
