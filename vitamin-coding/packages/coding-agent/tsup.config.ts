import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node22',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  esbuildOptions(options) {
    options.loader = {
      ...(options.loader ?? {}),
      '.tsx': 'tsx',
    }
  },
})
