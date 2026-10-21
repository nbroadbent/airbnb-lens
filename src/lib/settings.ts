/**
 * User settings, persisted in chrome.storage.sync (falls back to storage.local if
 * sync is unavailable, e.g. Firefox without an add-on id). Shared by the content
 * script and the popup. Every read goes through normalizeSettings() so a partial or
 * corrupt stored value can never crash the extension.
 */
import { log } from './log'

/** What maxNightly compares against. 'nightly' = all-in total ÷ nights; 'total' = the stay total as shown. */
export type PriceBasis = 'nightly' | 'total'

export interface Filters {
  /** Hide cards rated below this. null = off. Range 4.0–5.0. */
  minRating: number | null
  /** Hide cards with fewer reviews than this. null = off. */
  minReviews: number | null
  /** Hide cards whose price exceeds this. null = off. See priceBasis. */
  maxNightly: number | null
  /** 'nightly': all-in per night (total ÷ nights). 'total': the stay total Airbnb shows. */
  priceBasis: PriceBasis
  /** Hide cards with no rating ("new" listings). */
  hideUnrated: boolean
  /** Hide cards whose host is not a Superhost. */
  superhostOnly: boolean
}

export interface Settings {
  /** Master switch. When false Lens removes everything it injected and stays idle. */
  enabled: boolean
  /** Show the small "Airbnb Lens active" pill on augmented pages. */
  showStatusPill: boolean
  filters: Filters
}

export const DEFAULT_FILTERS: Filters = {
  minRating: null,
  minReviews: null,
  maxNightly: null,
  priceBasis: 'nightly',
  hideUnrated: false,
  superhostOnly: false,
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  showStatusPill: true,
  filters: DEFAULT_FILTERS,
}

const STORAGE_KEY = 'settings'

/** "1,000", "$500", " 25 " → 1000, 500, 25. Empty or no digits → null. */
export function parseLenientInt(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '')
  if (digits === '') return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function numOrNull(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < min || v > max) return null
  return v
}

function round2(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100) / 100
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

/** Merge anything (possibly garbage) into a complete, valid Settings object. */
export function normalizeSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {}
  const f = isRecord(r.filters) ? r.filters : {}
  return {
    enabled: bool(r.enabled, DEFAULT_SETTINGS.enabled),
    showStatusPill: bool(r.showStatusPill, DEFAULT_SETTINGS.showStatusPill),
    filters: {
      minRating: round2(numOrNull(f.minRating, 4.0, 5.0)),
      minReviews: numOrNull(f.minReviews, 0, 100_000),
      maxNightly: numOrNull(f.maxNightly, 0, 1_000_000),
      priceBasis: f.priceBasis === 'total' ? 'total' : 'nightly',
      hideUnrated: bool(f.hideUnrated, DEFAULT_FILTERS.hideUnrated),
      superhostOnly: bool(f.superhostOnly, DEFAULT_FILTERS.superhostOnly),
    },
  }
}

/** Pick the storage area: sync if usable, otherwise local. Memoized. */
let areaPromise: Promise<chrome.storage.StorageArea> | undefined
function area(): Promise<chrome.storage.StorageArea> {
  areaPromise ??= new Promise((resolve) => {
    const sync = chrome.storage.sync
    try {
      sync.get(STORAGE_KEY, () => {
        if (chrome.runtime.lastError) {
          log.warn('storage.sync unavailable, using storage.local:', chrome.runtime.lastError)
          resolve(chrome.storage.local)
        } else {
          resolve(sync)
        }
      })
    } catch (err) {
      log.warn('storage.sync threw, using storage.local:', err)
      resolve(chrome.storage.local)
    }
  })
  return areaPromise
}

export async function loadSettings(): Promise<Settings> {
  const a = await area()
  return new Promise((resolve) => {
    a.get(STORAGE_KEY, (items) => {
      if (chrome.runtime.lastError) {
        log.warn('loadSettings failed, using defaults:', chrome.runtime.lastError)
        resolve(DEFAULT_SETTINGS)
        return
      }
      resolve(normalizeSettings(items[STORAGE_KEY]))
    })
  })
}

export async function saveSettings(settings: Settings): Promise<void> {
  const a = await area()
  const clean = normalizeSettings(settings)
  return new Promise((resolve, reject) => {
    a.set({ [STORAGE_KEY]: clean }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else resolve()
    })
  })
}

/** Convenience: load, apply a patch, save, return the result. */
export async function updateSettings(
  patch: Partial<Omit<Settings, 'filters'>> & { filters?: Partial<Filters> },
): Promise<Settings> {
  const current = await loadSettings()
  const next: Settings = {
    ...current,
    ...patch,
    filters: { ...current.filters, ...(patch.filters ?? {}) },
  }
  await saveSettings(next)
  return normalizeSettings(next)
}

/** Subscribe to changes from any context (popup ↔ content script). Returns unsubscribe. */
export function onSettingsChange(cb: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>): void => {
    const c = changes[STORAGE_KEY]
    if (c) cb(normalizeSettings(c.newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => {
    chrome.storage.onChanged.removeListener(listener)
  }
}
