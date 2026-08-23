import { readFileSync } from 'node:fs'

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

if (!code.startsWith('window.__ModuleLoader__.load({') || !code.includes('id: "dsh-loghud"')) {
  throw new Error('lib/client.js does not register dsh-loghud through window.__ModuleLoader__.load')
}

const allowed = new Set(['react', 'react/jsx-runtime'])
const requested = [...code.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1])
const unsupported = requested.filter((specifier) => !allowed.has(specifier))

if (unsupported.length > 0) {
  throw new Error(`lib/client.js requests unsupported module-table entries: ${unsupported.join(', ')}`)
}

if (!code.includes('return module.exports;')) {
  throw new Error('lib/client.js factory does not return module.exports')
}
