import { defineConfig } from 'tsdown'

export default defineConfig([
  { entry: { index: 'src/index.ts', core: 'src/core/index.ts' }, outDir: 'lib', format: 'esm', dts: true, clean: true },
  {
    name: 'dsh-loghud/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => specifier === 'react' || specifier === 'react/jsx-runtime',
      alwaysBundle: (specifier: string) => specifier !== 'react' && specifier !== 'react/jsx-runtime',
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-loghud", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
