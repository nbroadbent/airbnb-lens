import { defineManifest } from '@crxjs/vite-plugin'
import { AIRBNB_MATCH_PATTERNS } from './src/domains.ts'
import pkg from './package.json' with { type: 'json' }

/**
 * Build target. `TARGET=firefox vite build` produces a Firefox manifest in
 * dist-firefox/; the default is Chrome into dist/. The only differences are the
 * `browser_specific_settings.gecko` block Firefox needs (for an add-on id and
 * storage.sync) and which Chrome would warn about.
 */
export const target: 'chrome' | 'firefox' = process.env.TARGET === 'firefox' ? 'firefox' : 'chrome'

export default defineManifest({
  manifest_version: 3,
  name: 'Airbnb Lens',
  description:
    'Shows what Airbnb withholds: calibrated ratings, true all-in nightly prices, and client-side filters. Runs entirely in your browser.',
  version: pkg.version,
  // `storage`: settings via chrome.storage.sync.
  // `activeTab`: lets the popup read the current tab's URL (only while open) so it
  //   can tell you whether you're on an Airbnb page. No network, no remote code.
  permissions: ['storage', 'activeTab'],
  action: {
    default_title: 'Airbnb Lens',
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [
    {
      matches: [...AIRBNB_MATCH_PATTERNS],
      js: ['src/content/index.ts'],
      // Declared here (not imported from the script) because the standalone IIFE
      // build drops CSS imports from the manifest.
      css: ['src/content/lens.css'],
      run_at: 'document_idle',
    },
  ],
  ...(target === 'firefox'
    ? {
        browser_specific_settings: {
          gecko: {
            id: 'airbnb-lens@lens.local',
            strict_min_version: '142.0',
            data_collection_permissions: { required: ['none'] },
          },
        },
      }
    : {}),
})
