import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // Library build (browser + server)
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    platform: 'browser',
    target: 'es2020',
  },
  {
    // CLI build (Node/Deno/Bun — fs access enabled)
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    platform: 'node',
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
  },
])
