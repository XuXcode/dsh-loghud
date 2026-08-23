import { describe, expect, it, vi } from 'vitest'
import { buildPrompt, DiagnosisService, ErrorStore, LogProcessor, redactSecrets } from '../src/core/index.js'
import { fixtures } from './fixtures.js'

function event() {
  const store = new ErrorStore(); new LogProcessor(store).finish('s', fixtures.npe, { captureMode: 'tool-result' })
  return store.snapshot('s').active[0]!
}

describe('security and opt-in AI', () => {
  it('redacts common secret families', () => {
    const source = `Authorization: Bearer abc.def.ghi\npassword=hunter2\nAPI_KEY=sk-secret\nhttps://alice:swordfish@example.com/x\neyJabcdefghijk.abcdefghijk.abcdef\n-----BEGIN PRIVATE KEY-----\nSECRET\n-----END PRIVATE KEY-----`
    const output = redactSecrets(source)
    for (const secret of ['abc.def.ghi', 'hunter2', 'sk-secret', 'swordfish', 'eyJabcdefghijk', 'SECRET']) expect(output).not.toContain(secret)
  })

  it('sends redacted bounded structured data to the model', () => {
    const input = { ...event(), rootMessage: 'password=hunter2', rawContext: ['Bearer token-value', ...Array.from({ length: 100 }, (_, i) => `line ${i}`)] }
    const prompt = buildPrompt(input, true)
    expect(prompt).not.toContain('hunter2'); expect(prompt).not.toContain('token-value'); expect(prompt).toContain('line 99'); expect(prompt).not.toContain('line 0"')
  })

  it('requires Simplified Chinese diagnosis when the client locale is Chinese', async () => {
    const generate = vi.fn(async (_prompt: string) => '{"simpleExplanation":"这是中文解释","likelyCauses":[],"suggestedChecks":[],"confidence":"high"}')
    const service = new DiagnosisService({ generate })
    const diagnosis = await service.diagnose(event(), undefined, 'zh-CN')
    expect(generate.mock.calls[0]?.[0]).toContain('Simplified Chinese')
    expect(generate.mock.calls[0]?.[0]).toContain('Do not include English translations')
    expect(diagnosis).toMatchObject({ simpleExplanation: '这是中文解释', locale: 'zh-CN' })
  })

  it('does not call AI until diagnose, calls once, and merges duplicate clicks', async () => {
    let release!: (value: string) => void
    const generate = vi.fn(() => new Promise<string>((resolve) => { release = resolve }))
    const service = new DiagnosisService({ generate })
    expect(service.calls).toBe(0); expect(generate).not.toHaveBeenCalled()
    const first = service.diagnose(event()); const second = service.diagnose(event())
    expect(service.calls).toBe(1); expect(generate).toHaveBeenCalledTimes(1)
    release('{"simpleExplanation":"x","likelyCauses":[],"suggestedChecks":[],"confidence":"high"}')
    await expect(first).resolves.toMatchObject({ simpleExplanation: 'x' }); await expect(second).resolves.toMatchObject({ confidence: 'high' })
  })

  it('falls back safely for non-JSON model text', async () => {
    const service = new DiagnosisService({ generate: async () => '<b>plain explanation</b>' })
    await expect(service.diagnose(event())).resolves.toMatchObject({ confidence: 'low', likelyCauses: [] })
  })

  it('keeps the local card when AI fails', async () => {
    const store = new ErrorStore(); new LogProcessor(store).finish('s', fixtures.npe, { captureMode: 'tool-result' })
    const service = new DiagnosisService({ generate: async () => { throw new Error('timeout') } })
    await expect(service.diagnose(store.snapshot('s').active[0]!)).rejects.toThrow('timeout')
    expect(store.snapshot('s').active).toHaveLength(1)
  })
})
