import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PANEL_STATE, mountPanel } from './panel'
import { DEFAULT_FILTERS } from '../lib/settings'

describe('mountPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('mounts once, shows counts, and reports filter changes', () => {
    const onFiltersChange = vi.fn()
    const onStateChange = vi.fn()
    mountPanel({
      filters: DEFAULT_FILTERS,
      state: DEFAULT_PANEL_STATE,
      onFiltersChange,
      onStateChange,
      onReset: vi.fn(),
    })
    // A second mount replaces the first instead of stacking.
    const handle = mountPanel({
      filters: DEFAULT_FILTERS,
      state: DEFAULT_PANEL_STATE,
      onFiltersChange,
      onStateChange,
      onReset: vi.fn(),
    })
    expect(document.querySelectorAll('#lens-panel')).toHaveLength(1)

    handle.setCount(12, 40)
    expect(document.querySelector('.lens-panel-count')?.textContent).toBe('Showing 12 of 40')

    const panel = document.querySelector<HTMLElement>('#lens-panel')
    const superhost = panel?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]
    if (!superhost) throw new Error('no checkbox')
    superhost.checked = true
    superhost.dispatchEvent(new Event('change'))
    expect(onFiltersChange).toHaveBeenCalledWith({ superhostOnly: true })

    panel?.querySelector<HTMLButtonElement>('.lens-panel-toggle')?.click()
    expect(panel?.classList.contains('lens-collapsed')).toBe(true)
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ collapsed: true }))
  })
})

describe('panel number fields', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  it('does not clobber a field that is being edited, and applies typed values', () => {
    const onFiltersChange = vi.fn()
    const handle = mountPanel({
      filters: DEFAULT_FILTERS,
      state: DEFAULT_PANEL_STATE,
      onFiltersChange,
      onStateChange: vi.fn(),
      onReset: vi.fn(),
    })
    const minReviews = document.querySelector<HTMLInputElement>('[data-lens-field="minReviews"]')
    const maxNightly = document.querySelector<HTMLInputElement>('[data-lens-field="maxNightly"]')
    if (!minReviews || !maxNightly) throw new Error('inputs missing')

    minReviews.focus()
    minReviews.value = '10'
    minReviews.dispatchEvent(new Event('input'))
    // A re-augment pass pushes stored (null) filters while the user is typing.
    handle.setFilters(DEFAULT_FILTERS)
    expect(minReviews.value).toBe('10')

    vi.advanceTimersByTime(400)
    expect(onFiltersChange).toHaveBeenCalledWith({ minReviews: 10 })

    maxNightly.focus()
    maxNightly.value = '500'
    maxNightly.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onFiltersChange).toHaveBeenCalledWith({ maxNightly: 500 })

    // Once nothing is focused, stored values do get applied.
    maxNightly.blur()
    handle.setFilters({ ...DEFAULT_FILTERS, maxNightly: 750 })
    expect(maxNightly.value).toBe('750')
  })

  it('keeps keystrokes inside the panel', () => {
    mountPanel({
      filters: DEFAULT_FILTERS,
      state: DEFAULT_PANEL_STATE,
      onFiltersChange: vi.fn(),
      onStateChange: vi.fn(),
      onReset: vi.fn(),
    })
    const seen = vi.fn()
    document.addEventListener('keydown', seen)
    const input = document.querySelector<HTMLInputElement>('[data-lens-field="minReviews"]')
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    expect(seen).not.toHaveBeenCalled()
  })

  it('accepts a two-decimal rating typed or dragged', () => {
    const onFiltersChange = vi.fn()
    const handle = mountPanel({
      filters: DEFAULT_FILTERS,
      state: DEFAULT_PANEL_STATE,
      onFiltersChange,
      onStateChange: vi.fn(),
      onReset: vi.fn(),
    })
    const box = document.querySelector<HTMLInputElement>('[data-lens-field="minRating"]')
    const slider = document.querySelector<HTMLInputElement>('[data-lens-field="minRatingSlider"]')
    if (!box || !slider) throw new Error('rating inputs missing')
    expect(slider.step).toBe('0.01')

    box.focus()
    box.value = '4.85'
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onFiltersChange).toHaveBeenCalledWith({ minRating: 4.85 })
    expect(slider.value).toBe('4.85')

    slider.value = '4.73'
    slider.dispatchEvent(new Event('change'))
    expect(onFiltersChange).toHaveBeenCalledWith({ minRating: 4.73 })

    slider.value = '3.99'
    slider.dispatchEvent(new Event('change'))
    expect(onFiltersChange).toHaveBeenCalledWith({ minRating: null })

    handle.setFilters({ ...DEFAULT_FILTERS, minRating: 4.9 })
    expect(box.value).toBe('4.90')
    handle.setFilters(DEFAULT_FILTERS)
    expect(box.value).toBe('')
  })
})
