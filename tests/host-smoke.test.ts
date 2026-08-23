import { expect, it } from 'vitest'

it('loads the Host entrypoint and validates persistence declarations', async () => {
  const plugin = await import('../src/index.js')
  expect(plugin.name).toBe('dsh-loghud')
  expect(plugin.inject).toEqual(['tools', 'webServer'])
})
