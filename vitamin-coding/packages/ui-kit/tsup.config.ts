import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2024',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  external: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
})
