import { AIRBNB_MATCH_PATTERNS, isAirbnbHost } from '../domains'
import { log } from '../lib/log'
import type { PingRequest, PingResponse } from '../lib/messages'
import {
  DEFAULT_FILTERS,
  loadSettings,
  onSettingsChange,
  parseLenientInt,
  type Settings,
  updateSettings,
} from '../lib/settings'

/*
 * Toolbar popup: answers "is Lens running on this tab?", provides the master on/off
 * switch, and edits the filter settings. Plain DOM, no framework. Everything is
 * saved to chrome.storage immediately; the content script picks changes up via
 * storage.onChanged.
 */

function $<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`popup: missing #${id}`)
  return node as T
}

const ui = {
  enabled: $<HTMLInputElement>('enabled'),
  enabledLabel: $<HTMLElement>('enabled-label'),
  statusDot: $<HTMLElement>('status-dot'),
  statusText: $<HTMLElement>('status-text'),
  grant: $<HTMLButtonElement>('grant'),
  filters: $<HTMLElement>('filters'),
  minRating: $<HTMLInputElement>('minRating'),
  minRatingOut: $<HTMLInputElement>('minRating-out'),
  minReviews: $<HTMLInputElement>('minReviews'),
  maxNightly: $<HTMLInputElement>('maxNightly'),
  priceBasis: $<HTMLSelectElement>('priceBasis'),
  hideUnrated: $<HTMLInputElement>('hideUnrated'),
  superhostOnly: $<HTMLInputElement>('superhostOnly'),
  showStatusPill: $<HTMLInputElement>('showStatusPill'),
  reset: $<HTMLButtonElement>('reset'),
  version: $<HTMLElement>('version'),
}

/* ---------- Promise wrappers over callback APIs (work in Chrome and Firefox) ---------- */

function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) resolve(undefined)
      else resolve(tabs[0])
    })
  })
}

function ping(tabId: number): Promise<PingResponse | undefined> {
  const req: PingRequest = { type: 'lens:ping' }
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, req, (res: unknown) => {
        if (chrome.runtime.lastError) {
          resolve(undefined)
          return
        }
        const r = res as Partial<PingResponse> | undefined
        resolve(r && r.type === 'lens:pong' ? (r as PingResponse) : undefined)
      })
    } catch {
      resolve(undefined)
    }
  })
}

function hasAirbnbPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ origins: [...AIRBNB_MATCH_PATTERNS] }, (granted) => {
        resolve(chrome.runtime.lastError ? true : granted)
      })
    } catch {
      resolve(true)
    }
  })
}

function requestAirbnbPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.permissions.request({ origins: [...AIRBNB_MATCH_PATTERNS] }, (granted) => {
        resolve(chrome.runtime.lastError ? false : granted)
      })
    } catch {
      resolve(false)
    }
  })
}

/* ---------- Status ---------- */

type Tone = 'ok' | 'warn' | 'bad' | 'idle'

function setStatus(tone: Tone, text: string): void {
  ui.statusDot.className = `dot${tone === 'idle' ? '' : ` ${tone}`}`
  ui.statusText.textContent = text
}

async function refreshStatus(): Promise<void> {
  const tab = await activeTab()
  const url = tab?.url ?? tab?.pendingUrl ?? ''
  let onAirbnb = false
  try {
    onAirbnb = url !== '' && isAirbnbHost(new URL(url).hostname)
  } catch {
    onAirbnb = false
  }

  if (!onAirbnb) {
    setStatus('idle', 'Open an Airbnb search or listing page to see Lens work.')
    ui.grant.classList.add('hidden')
    return
  }

  const pong = tab?.id !== undefined ? await ping(tab.id) : undefined

  if (pong) {
    ui.grant.classList.add('hidden')
    if (!pong.enabled) {
      setStatus('warn', 'Lens is loaded on this tab but switched off.')
    } else if (pong.page === 'other') {
      setStatus('ok', 'Lens is running. This is not a search or listing page, so nothing to show.')
    } else {
      setStatus('ok', `Lens is running on this ${pong.page} page (v${pong.version}).`)
    }
    return
  }

  // On an Airbnb page but the content script did not answer.
  const permitted = await hasAirbnbPermission()
  if (!permitted) {
    setStatus(
      'bad',
      'Lens cannot run here yet: the browser has not granted access to Airbnb. Click below, then reload the page.',
    )
    ui.grant.classList.remove('hidden')
  } else {
    setStatus(
      'bad',
      'Lens is not running on this tab. Reload the page (the extension was installed or updated after it loaded).',
    )
    ui.grant.classList.add('hidden')
  }
}

/* ---------- Settings ↔ form ---------- */

const RATING_OFF = 3.99 // slider's lowest notch means "off"
const ratingOrNull = (v: number): number | null =>
  Number.isFinite(v) && v >= 4 ? Math.min(5, Math.round(v * 100) / 100) : null
const fmtRating = (v: number | null): string => (v === null ? '' : v.toFixed(2))

function render(s: Settings): void {
  ui.enabled.checked = s.enabled
  ui.enabledLabel.textContent = s.enabled ? 'On' : 'Off'
  ui.filters.classList.toggle('disabled', !s.enabled)

  const r = s.filters.minRating
  ui.minRating.value = String(r ?? RATING_OFF)
  ui.minRatingOut.value = r === null ? 'off' : r.toFixed(1)
  const put = (input: HTMLInputElement, value: string): void => {
    if (input === document.activeElement) return
    if (input.value !== value) input.value = value
  }
  put(ui.minRatingOut, fmtRating(s.filters.minRating))
  put(ui.minReviews, s.filters.minReviews === null ? '' : String(s.filters.minReviews))
  put(ui.maxNightly, s.filters.maxNightly === null ? '' : String(s.filters.maxNightly))
  if (ui.priceBasis.value !== s.filters.priceBasis) ui.priceBasis.value = s.filters.priceBasis
  ui.hideUnrated.checked = s.filters.hideUnrated
  ui.superhostOnly.checked = s.filters.superhostOnly
  ui.showStatusPill.checked = s.showStatusPill
}

function numberOrNull(input: HTMLInputElement): number | null {
  return parseLenientInt(input.value)
}

function wire(): void {
  ui.enabled.addEventListener('change', () => {
    void updateSettings({ enabled: ui.enabled.checked }).then(async (s) => {
      render(s)
      await refreshStatus()
    })
  })

  ui.minRating.addEventListener('input', () => {
    ui.minRatingOut.value = fmtRating(ratingOrNull(ui.minRating.valueAsNumber))
  })
  ui.minRating.addEventListener('change', () => {
    void updateSettings({ filters: { minRating: ratingOrNull(ui.minRating.valueAsNumber) } }).then(
      render,
    )
  })
  {
    let timer: ReturnType<typeof setTimeout> | undefined
    const commit = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      const v = ratingOrNull(ui.minRatingOut.valueAsNumber)
      ui.minRating.value = String(v ?? RATING_OFF)
      void updateSettings({ filters: { minRating: v } }).then(render)
    }
    ui.minRatingOut.addEventListener('input', () => {
      ui.minRating.value = String(ratingOrNull(ui.minRatingOut.valueAsNumber) ?? RATING_OFF)
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(commit, 400)
    })
    ui.minRatingOut.addEventListener('change', commit)
    ui.minRatingOut.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      }
    })
  }

  const wireNumber = (input: HTMLInputElement, key: 'minReviews' | 'maxNightly'): void => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const commit = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      void updateSettings({ filters: { [key]: numberOrNull(input) } }).then(render)
    }
    input.addEventListener('input', () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(commit, 400)
    })
    input.addEventListener('change', commit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      }
    })
  }
  wireNumber(ui.minReviews, 'minReviews')
  wireNumber(ui.maxNightly, 'maxNightly')
  ui.priceBasis.addEventListener('change', () => {
    void updateSettings({
      filters: { priceBasis: ui.priceBasis.value === 'total' ? 'total' : 'nightly' },
    }).then(render)
  })
  ui.hideUnrated.addEventListener('change', () => {
    void updateSettings({ filters: { hideUnrated: ui.hideUnrated.checked } }).then(render)
  })
  ui.superhostOnly.addEventListener('change', () => {
    void updateSettings({ filters: { superhostOnly: ui.superhostOnly.checked } }).then(render)
  })
  ui.showStatusPill.addEventListener('change', () => {
    void updateSettings({ showStatusPill: ui.showStatusPill.checked }).then(render)
  })

  ui.reset.addEventListener('click', () => {
    void updateSettings({ filters: { ...DEFAULT_FILTERS } }).then(render)
  })

  ui.grant.addEventListener('click', () => {
    void requestAirbnbPermission().then(async (granted) => {
      log.info('permission request result:', granted)
      await refreshStatus()
    })
  })

  // Keep in sync if another popup/tab changes settings while this one is open.
  onSettingsChange(render)
}

async function init(): Promise<void> {
  ui.version.textContent = `v${chrome.runtime.getManifest().version}`
  wire()
  const settings = await loadSettings()
  render(settings)
  await refreshStatus()
}

init().catch((err: unknown) => {
  log.error('popup failed to initialise:', err)
  setStatus('bad', 'Popup failed to initialise. See the extension console.')
})
