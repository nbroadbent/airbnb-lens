import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  parseLenientInt,
  loadSettings,
  normalizeSettings,
  saveSettings,
  updateSettings,
} from './settings'

describe('parseLenientInt', () => {
  it('accepts human-formatted numbers', () => {
    expect(parseLenientInt('1,000')).toBe(1000)
    expect(parseLenientInt('$500')).toBe(500)
    expect(parseLenientInt(' 25 ')).toBe(25)
    expect(parseLenientInt('RM 1 200')).toBe(1200)
    expect(parseLenientInt('')).toBeNull()
    expect(parseLenientInt('off')).toBeNull()
  })
})

describe('normalizeSettings', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid values and fills gaps', () => {
    const s = normalizeSettings({ enabled: false, filters: { minRating: 4.7, hideUnrated: true } })
    expect(s.enabled).toBe(false)
    expect(s.showStatusPill).toBe(true)
    expect(s.filters).toEqual({
      minRating: 4.7,
      minReviews: null,
      maxNightly: null,
      hideUnrated: true,
      superhostOnly: false,
    })
  })

  it('keeps two decimals of rating precision', () => {
    expect(normalizeSettings({ filters: { minRating: 4.85 } }).filters.minRating).toBe(4.85)
    expect(normalizeSettings({ filters: { minRating: 4.8549 } }).filters.minRating).toBe(4.85)
  })

  it('rejects out-of-range or wrong-typed numbers', () => {
    const s = normalizeSettings({
      filters: { minRating: 7, minReviews: -1, maxNightly: '100' },
    })
    expect(s.filters.minRating).toBeNull()
    expect(s.filters.minReviews).toBeNull()
    expect(s.filters.maxNightly).toBeNull()
  })
})

/** Minimal in-memory fake of chrome.storage with the callback API we use. */
function fakeChrome() {
  const store: Record<string, unknown> = {}
  const listeners = new Set<(c: Record<string, chrome.storage.StorageChange>) => void>()
  const areaImpl = {
    get: (key: string, cb: (items: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] })
    },
    set: (items: Record<string, unknown>, cb: () => void) => {
      for (const [k, v] of Object.entries(items)) {
        const oldValue = store[k]
        store[k] = v
        for (const l of listeners) l({ [k]: { oldValue, newValue: v } })
      }
      cb()
    },
  }
  return {
    store,
    chrome: {
      runtime: { lastError: undefined },
      storage: {
        sync: areaImpl,
        local: areaImpl,
        onChanged: {
          addListener: (l: (c: Record<string, chrome.storage.StorageChange>) => void) =>
            listeners.add(l),
          removeListener: (l: (c: Record<string, chrome.storage.StorageChange>) => void) =>
            listeners.delete(l),
        },
      },
    },
  }
}

describe('load/save/update settings', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', fakeChrome().chrome)
  })

  it('round-trips through storage', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    await saveSettings({ ...DEFAULT_SETTINGS, enabled: false })
    expect((await loadSettings()).enabled).toBe(false)
  })

  it('patches nested filters without clobbering siblings', async () => {
    await updateSettings({ filters: { minRating: 4.8 } })
    const s = await updateSettings({ filters: { minReviews: 25 } })
    expect(s.filters.minRating).toBe(4.8)
    expect(s.filters.minReviews).toBe(25)
  })
})
