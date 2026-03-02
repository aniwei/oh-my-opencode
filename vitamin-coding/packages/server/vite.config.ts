import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  root: 'inspector',
  build: {
    outDir: '../dist/inspector',
    emptyOutDir: true,
  },
  server: {
    port: 9230,
    proxy: {
      '/api': {
        target: 'http://localhost:9229',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:9229',
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './inspector')
    }
  }
})
