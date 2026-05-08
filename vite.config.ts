/// <reference types="node" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4200,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    // jsdom only exposes localStorage on non-opaque origins; without a URL
    // window.localStorage is missing methods like clear() under Node 22+.
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
