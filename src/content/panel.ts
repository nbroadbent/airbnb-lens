/**
 * Floating filter panel for search pages: bottom-right, collapsible, draggable.
 * Shows "Showing X of Y" and the same filters as the toolbar popup. No chrome.*
 * access in here — the caller wires persistence so this is testable in jsdom.
 */
import { el } from '../lib/dom'
import { parseLenientInt, type Filters } from '../lib/settings'

export interface PanelState {
  collapsed: boolean
  /** Pixel offset from the viewport's bottom-right corner. */
  right: number
  bottom: number
}

export const DEFAULT_PANEL_STATE: PanelState = { collapsed: false, right: 16, bottom: 16 }

export interface PanelHandle {
  root: HTMLElement
  setCount: (shown: number, total: number, note?: string) => void
  setFilters: (f: Filters) => void
  remove: () => void
}

export interface PanelOptions {
  filters: Filters
  state: PanelState
  onFiltersChange: (patch: Partial<Filters>) => void
  onStateChange: (state: PanelState) => void
  onReset: () => void
}

const PANEL_ID = 'lens-panel'
/** Slider's lowest notch means "off"; anything below 4.00 is treated as no threshold. */
const RATING_OFF = 3.99
const ratingOrNull = (v: number): number | null =>
  Number.isFinite(v) && v >= 4 ? Math.min(5, Math.round(v * 100) / 100) : null
const fmtRating = (v: number | null): string => (v === null ? '' : v.toFixed(2))

export function mountPanel(opts: PanelOptions, root: ParentNode = document): PanelHandle {
  const existing = root.querySelector<HTMLElement>(`#${PANEL_ID}`)
  existing?.remove()

  const d = (root as Document).createElement ? (root as Document) : document
  const state: PanelState = { ...opts.state }

  const panel = el('div', {
    id: PANEL_ID,
    class: 'lens-panel',
    role: 'region',
    'aria-label': 'Airbnb Lens filters',
  })
  d.adoptNode(panel)
  panel.style.right = `${state.right}px`
  panel.style.bottom = `${state.bottom}px`
  panel.classList.toggle('lens-collapsed', state.collapsed)

  // Header (drag handle)
  const header = el('div', { class: 'lens-panel-header' })
  const title = el('span', { class: 'lens-panel-title' }, 'Airbnb Lens')
  const count = el('span', { class: 'lens-panel-count', 'aria-live': 'polite' }, '')
  const toggle = el(
    'button',
    {
      class: 'lens-panel-toggle',
      type: 'button',
      'aria-expanded': String(!state.collapsed),
      title: 'Collapse / expand',
    },
    state.collapsed ? '▴' : '▾',
  )
  header.append(title, count, toggle)

  // Body
  const body = el('div', { class: 'lens-panel-body' })

  const field = (labelText: string, input: HTMLElement, trailing?: HTMLElement): HTMLElement => {
    const wrap = el('label', { class: 'lens-field' })
    const lab = el('span', { class: 'lens-field-label' })
    lab.append(el('span', {}, labelText))
    if (trailing) lab.append(trailing)
    wrap.append(lab, input)
    return wrap
  }
  const check = (labelText: string, input: HTMLInputElement): HTMLElement => {
    const wrap = el('label', { class: 'lens-check' })
    wrap.append(input, el('span', {}, labelText))
    return wrap
  }

  const minRating = el('input', {
    type: 'range',
    min: String(RATING_OFF),
    max: '5',
    step: '0.01',
    'data-lens-field': 'minRatingSlider',
  })
  const minRatingOut = el('input', {
    type: 'number',
    class: 'lens-out',
    min: '4',
    max: '5',
    step: '0.01',
    placeholder: 'off',
    inputmode: 'decimal',
    'data-lens-field': 'minRating',
    'aria-label': 'Minimum rating',
  })
  // Text (not type=number) so "1,000" or "$500" are accepted instead of silently blanked.
  const minReviews = el('input', {
    type: 'text',
    placeholder: 'off',
    inputmode: 'numeric',
    autocomplete: 'off',
    'data-lens-field': 'minReviews',
  })
  const maxNightly = el('input', {
    type: 'text',
    placeholder: 'off',
    inputmode: 'numeric',
    autocomplete: 'off',
    'data-lens-field': 'maxNightly',
  })
  const hideUnrated = el('input', { type: 'checkbox' })
  const superhostOnly = el('input', { type: 'checkbox' })
  const reset = el('button', { type: 'button', class: 'lens-btn' }, 'Reset filters')

  const noteLine = el('div', { class: 'lens-note', hidden: '' })
  body.append(
    noteLine,
    field('Min rating', minRating, minRatingOut),
    field('Min reviews', minReviews),
    field('Max all-in price / night', maxNightly),
    check('Hide listings without ratings', hideUnrated),
    check("Hide listings whose host isn't a Superhost", superhostOnly),
    reset,
  )
  panel.append(header, body)

  // ---- wiring ----
  const numOrNull = (i: HTMLInputElement): number | null => parseLenientInt(i.value)

  minRating.addEventListener('input', () => {
    minRatingOut.value = fmtRating(ratingOrNull(minRating.valueAsNumber))
  })
  minRating.addEventListener('change', () => {
    opts.onFiltersChange({ minRating: ratingOrNull(minRating.valueAsNumber) })
  })
  // Typed rating: mirror to the slider live, commit debounced / on Enter / on change.
  {
    let timer: ReturnType<typeof setTimeout> | undefined
    const commit = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      const v = ratingOrNull(minRatingOut.valueAsNumber)
      minRating.value = String(v ?? RATING_OFF)
      opts.onFiltersChange({ minRating: v })
    }
    minRatingOut.addEventListener('input', () => {
      const v = ratingOrNull(minRatingOut.valueAsNumber)
      minRating.value = String(v ?? RATING_OFF)
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(commit, 400)
    })
    minRatingOut.addEventListener('change', commit)
    minRatingOut.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
        minRatingOut.blur()
      }
    })
  }
  // Number fields apply as you type (debounced) and on change/Enter.
  const wireNumber = (input: HTMLInputElement, key: 'minReviews' | 'maxNightly'): void => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const commit = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      opts.onFiltersChange({ [key]: numOrNull(input) })
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
        input.blur()
      }
    })
  }
  wireNumber(minReviews, 'minReviews')
  wireNumber(maxNightly, 'maxNightly')

  // Airbnb has document-level key handlers; don't let keystrokes in our panel reach them.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    panel.addEventListener(type, (e) => {
      e.stopPropagation()
    })
  }
  hideUnrated.addEventListener('change', () => {
    opts.onFiltersChange({ hideUnrated: hideUnrated.checked })
  })
  superhostOnly.addEventListener('change', () => {
    opts.onFiltersChange({ superhostOnly: superhostOnly.checked })
  })
  reset.addEventListener('click', () => {
    opts.onReset()
  })

  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    state.collapsed = !state.collapsed
    panel.classList.toggle('lens-collapsed', state.collapsed)
    toggle.setAttribute('aria-expanded', String(!state.collapsed))
    toggle.textContent = state.collapsed ? '▴' : '▾'
    opts.onStateChange({ ...state })
  })

  // Drag by header. Positions are stored as right/bottom offsets so the panel stays
  // anchored to the corner on resize.
  let drag: { startX: number; startY: number; right: number; bottom: number } | null = null
  header.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return
    drag = { startX: e.clientX, startY: e.clientY, right: state.right, bottom: state.bottom }
    header.setPointerCapture(e.pointerId)
    panel.classList.add('lens-dragging')
  })
  header.addEventListener('pointermove', (e) => {
    if (!drag) return
    const view = panel.ownerDocument.defaultView
    const maxRight = Math.max(0, (view?.innerWidth ?? 10_000) - panel.offsetWidth)
    const maxBottom = Math.max(0, (view?.innerHeight ?? 10_000) - panel.offsetHeight)
    state.right = Math.min(maxRight, Math.max(0, drag.right - (e.clientX - drag.startX)))
    state.bottom = Math.min(maxBottom, Math.max(0, drag.bottom - (e.clientY - drag.startY)))
    panel.style.right = `${state.right}px`
    panel.style.bottom = `${state.bottom}px`
  })
  const endDrag = (e: PointerEvent): void => {
    if (!drag) return
    drag = null
    panel.classList.remove('lens-dragging')
    try {
      header.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    opts.onStateChange({ ...state })
  }
  header.addEventListener('pointerup', endDrag)
  header.addEventListener('pointercancel', endDrag)

  /** Push stored filters into the controls — but never clobber a field being edited. */
  const setFilters = (f: Filters): void => {
    const active = panel.ownerDocument.activeElement
    const put = (input: HTMLInputElement, value: string): void => {
      if (input === active) return
      if (input.value !== value) input.value = value
    }
    put(minRating, String(f.minRating ?? RATING_OFF))
    put(minRatingOut, fmtRating(f.minRating))
    put(minReviews, f.minReviews === null ? '' : String(f.minReviews))
    put(maxNightly, f.maxNightly === null ? '' : String(f.maxNightly))
    hideUnrated.checked = f.hideUnrated
    superhostOnly.checked = f.superhostOnly
  }
  setFilters(opts.filters)

  const host = (root as Document).body ?? root
  host.appendChild(panel)

  return {
    root: panel,
    setCount: (shown, total, note) => {
      count.textContent = total === 0 ? '' : `Showing ${shown} of ${total}`
      count.title = note ?? ''
      noteLine.textContent = note ?? ''
      noteLine.hidden = !note
    },
    setFilters,
    remove: () => {
      panel.remove()
    },
  }
}
