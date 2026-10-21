import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest, { target } from './manifest.config.ts'

// Build config for the extension itself. Unit tests use vitest.config.ts so the
// CRXJS plugin never runs under Vitest.
export default defineConfig({
  plugins: [
    crx({
      manifest,
      browser: target,
      contentScripts: {
        // Build the content script as one self-contained IIFE instead of CRXJS's
        // loader + dynamic import(). Works identically in Chrome and Firefox and
        // has nothing to break at runtime.
        standaloneFiles: ['src/content/index.ts'],
      },
    }),
  ],
  build: {
    outDir: target === 'firefox' ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  // Dev server settings CRXJS needs so content-script HMR can reach Vite.
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
    cors: { origin: [/chrome-extension:\/\//, /moz-extension:\/\//] },
  },
})
