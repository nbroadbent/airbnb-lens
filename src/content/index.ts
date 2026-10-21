import { logPageDiagnostics, removeStatusPill, renderStatusPill } from './hello'
import { DEFAULT_PANEL_STATE, mountPanel, type PanelHandle, type PanelState } from './panel'
import { augmentSearchPage, teardownSearchPage } from './search'
import { LENS_ATTR } from '../lib/dom'
import { guarded, log } from '../lib/log'
import { isPingRequest, type PingResponse } from '../lib/messages'
import { classifyPage } from '../lib/page'
import {
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  loadSettings,
  onSettingsChange,
  type Settings,
  updateSettings,
} from '../lib/settings'
import { watchSpa } from '../lib/spa'

/**
 * Content-script entry. Runs on every Airbnb page (see manifest matches), decides
 * what kind of page it is, and applies the augmentations for that kind. Each
 * augmentation is wrapped so a failure in one never affects the others.
 */

let settings: Settings = DEFAULT_SETTINGS
let panel: PanelHandle | null = null
let panelState: PanelState = DEFAULT_PANEL_STATE

const PANEL_STATE_KEY = 'panelState'

function loadPanelState(): Promise<PanelState> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(PANEL_STATE_KEY, (items) => {
        const v = items[PANEL_STATE_KEY] as Partial<PanelState> | undefined
        resolve({ ...DEFAULT_PANEL_STATE, ...(v ?? {}) })
      })
    } catch {
      resolve(DEFAULT_PANEL_STATE)
    }
  })
}

function savePanelState(state: PanelState): void {
  panelState = state
  try {
    chrome.storage.local.set({ [PANEL_STATE_KEY]: state })
  } catch (err) {
    log.warn('could not persist panel state:', err)
  }
}

/** Remove everything Lens injected and undo any hiding. Safe to call repeatedly. */
function teardown(): void {
  teardownSearchPage()
  panel?.remove()
  panel = null
  for (const node of Array.from(document.querySelectorAll(`[${LENS_ATTR}="1"]`))) node.remove()
}

function ensurePanel(): PanelHandle {
  if (panel && document.body.contains(panel.root)) return panel
  panel = mountPanel({
    filters: settings.filters,
    state: panelState,
    onFiltersChange: (patch) => {
      void updateSettings({ filters: patch }).catch((err: unknown) => {
        log.error('saving filters failed:', err)
      })
    },
    onReset: () => {
      void updateSettings({ filters: { ...DEFAULT_FILTERS } })
    },
    onStateChange: savePanelState,
  })
  return panel
}

function augment(reason: string): void {
  const kind = classifyPage(location.href)

  if (!settings.enabled) {
    guarded('teardown', teardown)
    return
  }

  if (kind === 'search') {
    guarded('removeStatusPill', removeStatusPill)
    const p = guarded('ensurePanel', ensurePanel)
    p?.setFilters(settings.filters)
    const result = guarded('augmentSearchPage', () => augmentSearchPage(settings.filters))
    if (result) {
      const notes: string[] = []
      if (settings.filters.maxNightly !== null && result.listedOnly > 0)
        notes.push(`${result.listedOnly} priced by listed nightly rate (fees unknown)`)
      if (settings.filters.maxNightly !== null && result.noPrice > 0)
        notes.push(
          `${result.noPrice} without ${settings.filters.priceBasis === 'total' ? 'a stay total' : 'a price'} (shown, not filtered)`,
        )
      if (result.unresolved > 0) notes.push(`${result.unresolved} unreadable`)
      p?.setCount(result.shown, result.total, notes.length ? notes.join(' · ') : undefined)
    }
  } else {
    guarded('teardownSearchPage', teardownSearchPage)
    panel?.remove()
    panel = null
    if (kind === 'listing' && settings.showStatusPill) {
      guarded('renderStatusPill', () => renderStatusPill(kind))
    } else {
      guarded('removeStatusPill', removeStatusPill)
    }
  }

  if (reason === 'initial' || reason.startsWith('navigation')) {
    log.info(`page: ${kind} (${reason})`)
    guarded('logPageDiagnostics', logPageDiagnostics)
  }
}

/** Let the popup ask "are you alive, and what page is this?" */
function listenForPing(): void {
  chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    if (!isPingRequest(msg)) return
    const res: PingResponse = {
      type: 'lens:pong',
      version: chrome.runtime.getManifest().version,
      page: classifyPage(location.href),
      enabled: settings.enabled,
      url: location.href,
    }
    sendResponse(res)
  })
}

async function main(): Promise<void> {
  log.info('content script loaded', { version: chrome.runtime.getManifest().version })
  listenForPing()

  ;[settings, panelState] = await Promise.all([loadSettings(), loadPanelState()])
  log.info('settings', settings)

  augment('initial')
  watchSpa(augment)

  onSettingsChange((next) => {
    settings = next
    log.info('settings changed', next)
    augment('settings')
  })
}

main().catch((err: unknown) => {
  log.error('fatal in main:', err)
})
