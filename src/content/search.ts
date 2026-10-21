/**
 * Search-results augmentation (MVP features 1–3):
 *   1. calibrated rating badge      2. true all-in nightly price      3. client-side filters
 *
 * Data flow: embedded JSON (primary) → per-id index; each card is matched by its
 * /rooms/<id> link. Cards missing from the JSON (client-side pagination, map moves)
 * fall back to reading the card's own text. All DOM writes are idempotent and
 * tagged data-lens="1"; filtering is reversible.
 */
import {
  cardHideTarget,
  cardId,
  findCards,
  findPriceForNights,
  findRatingDisplay,
  readCardFromDom,
} from './cards'
import { el } from '../lib/dom'
import { readEmbeddedState } from '../lib/embedded'
import { filtersActive, passesFilters } from '../lib/filter'
import { extractSearchResults, filterPrice, type ListingSummary } from '../lib/listing'
import { guarded, log } from '../lib/log'
import { formatMoney, nightsFromUrl } from '../lib/price'
import { calibrateRating } from '../lib/rating'
import type { Filters } from '../lib/settings'
import { q } from '../selectors'

export interface SearchAugmentResult {
  total: number
  shown: number
  hidden: number
  /** How many cards were resolved from embedded JSON vs DOM fallback. */
  fromJson: number
  fromDom: number
  unresolved: number
  /** Cards with no price at all (filtering by price can't touch them). */
  noPrice: number
  /** Cards priced only by their listed nightly rate (fees unknown; hidden only if that already exceeds the cap). */
  listedOnly: number
  /** Cards with no rating. */
  noRating: number
}

const HIDE_ORIGINAL = 'data-lens-hide-original'
const HIDDEN = 'data-lens-hidden'

/* ---------- JSON index (cached per document) ---------- */

const indexCache = new WeakMap<ParentNode, { count: number; byId: Map<string, ListingSummary> }>()

/** Nights implied by the page's own URL, if dates are set. */
export function pageNightsHint(root: ParentNode = document): number | undefined {
  const href = (root as Document).location?.href ?? (root.ownerDocument ?? document).location.href
  return nightsFromUrl(href)
}

export function listingIndex(root: ParentNode = document): Map<string, ListingSummary> {
  const scripts = root.querySelectorAll('script[id^="data-deferred-state"]').length
  const cached = indexCache.get(root)
  if (cached && cached.count === scripts) return cached.byId
  const byId = new Map<string, ListingSummary>()
  const opts = { nightsHint: pageNightsHint(root) }
  for (const blob of readEmbeddedState(root)) {
    for (const s of extractSearchResults(blob, opts)) byId.set(s.id, s)
  }
  indexCache.set(root, { count: scripts, byId })
  return byId
}

/* ---------- Per-card summary (cached on the element) ---------- */

const summaryCache = new WeakMap<Element, { summary: ListingSummary; source: 'json' | 'dom' }>()

export function summarizeCard(
  card: HTMLElement,
  index: Map<string, ListingSummary>,
  nightsHint?: number,
): { summary: ListingSummary; source: 'json' | 'dom' } | null {
  const cached = summaryCache.get(card)
  if (cached) return cached
  const id = cardId(card)
  const fromJson = id ? index.get(id) : undefined
  let result: { summary: ListingSummary; source: 'json' | 'dom' } | null = null
  if (fromJson) {
    // JSON may lack Superhost/rating in odd cases; let the DOM fill gaps.
    const dom = readCardFromDom(card, nightsHint)
    result = {
      source: 'json',
      summary: {
        ...fromJson,
        superhost: fromJson.superhost || (dom?.superhost ?? false),
        rating: fromJson.rating ?? dom?.rating ?? null,
        reviews: fromJson.reviews ?? dom?.reviews ?? null,
        total: fromJson.total ?? dom?.total ?? null,
        nights: fromJson.nights ?? dom?.nights ?? null,
        perNight: fromJson.perNight ?? dom?.perNight ?? null,
        nightlyBase: fromJson.nightlyBase ?? dom?.nightlyBase ?? null,
      },
    }
  } else {
    const dom = readCardFromDom(card, nightsHint)
    if (dom) result = { source: 'dom', summary: dom }
  }
  if (result) summaryCache.set(card, result)
  return result
}

/* ---------- Feature 1: calibrated rating badge ---------- */

function docOf(node: Node): Document {
  return node.ownerDocument ?? document
}

export function renderRatingBadge(card: HTMLElement, s: ListingSummary): void {
  const existing = card.querySelector<HTMLElement>('[data-lens-badge]')
  const cal = calibrateRating(s.rating, s.reviews)
  const text =
    s.rating === null
      ? 'new'
      : `${s.rating.toFixed(2).replace(/0$/, '')} · ${cal.label}${s.reviews !== null ? ` · ${s.reviews}` : ''}`
  const title =
    s.rating === null
      ? 'No reviews yet'
      : `${s.rating} from ${s.reviews ?? '?'} reviews. Airbnb median is ~4.8, so this is ${cal.label}.${cal.lowConfidence ? ' Fewer than 10 reviews: low confidence.' : ''}`

  if (existing) {
    // Only touch the DOM when something changed; avoids needless mutation records.
    if (existing.textContent !== text) existing.textContent = text
    if (existing.title !== title) existing.title = title
    if (existing.dataset.tone !== cal.color) existing.dataset.tone = cal.color
    existing.classList.toggle('lens-dim', cal.lowConfidence)
    return
  }

  const d = docOf(card)
  const badge = el('span', { class: 'lens-badge', 'data-lens-badge': '1', title }, text)
  badge.dataset.tone = cal.color
  badge.classList.toggle('lens-dim', cal.lowConfidence)
  d.adoptNode(badge)

  const ratingEl = findRatingDisplay(card)
  if (ratingEl) {
    ratingEl.setAttribute(HIDE_ORIGINAL, '1')
    ratingEl.insertAdjacentElement('afterend', badge)
    return
  }
  const titleEl = q<HTMLElement>('cardTitle', card)
  if (titleEl) titleEl.insertAdjacentElement('afterend', badge)
  else card.append(badge)
}

/* ---------- Feature 2: true nightly price ---------- */

export function renderPerNight(card: HTMLElement, s: ListingSummary): void {
  const existing = card.querySelector<HTMLElement>('[data-lens-price]')
  if (s.perNight === null || s.total === null) {
    existing?.remove()
    return
  }
  const text = `${formatMoney(s.perNight, s.total.currency, s.total.suffix)}/night all-in`
  const base = s.nightlyBase
    ? ` · ${formatMoney(s.nightlyBase.amount, s.nightlyBase.currency, s.nightlyBase.suffix)}/night before fees`
    : ''
  const title = `${formatMoney(s.total.amount, s.total.currency, s.total.suffix)} total ÷ ${s.nights} nights${base}`
  if (existing) {
    if (existing.textContent !== text) existing.textContent = text
    if (existing.title !== title) existing.title = title
    return
  }
  const d = docOf(card)
  const node = el('div', { class: 'lens-pernight', 'data-lens-price': '1', title }, text)
  d.adoptNode(node)
  const anchor =
    findPriceForNights(card)?.el.closest('[data-testid="price-availability-row"]') ??
    q('priceRow', card)
  if (anchor) anchor.append(node)
  else card.append(node)
}

/* ---------- Feature 3: filters ---------- */

export function setCardHidden(card: HTMLElement, hidden: boolean): void {
  const target = cardHideTarget(card)
  if (hidden) {
    if (!target.hasAttribute(HIDDEN)) {
      target.setAttribute(HIDDEN, '1')
      target.style.setProperty('display', 'none', 'important')
    }
  } else if (target.hasAttribute(HIDDEN)) {
    target.removeAttribute(HIDDEN)
    target.style.removeProperty('display')
  }
}

/* ---------- Orchestration ---------- */

export function augmentSearchPage(
  filters: Filters,
  root: ParentNode = document,
): SearchAugmentResult {
  const index = listingIndex(root)
  const nightsHint = pageNightsHint(root)
  const cards = findCards(root)
  const result: SearchAugmentResult = {
    total: cards.length,
    shown: 0,
    hidden: 0,
    fromJson: 0,
    fromDom: 0,
    unresolved: 0,
    noPrice: 0,
    listedOnly: 0,
    noRating: 0,
  }
  const active = filtersActive(filters)

  for (const card of cards) {
    const resolved = guarded('summarizeCard', () => summarizeCard(card, index, nightsHint))
    if (!resolved) {
      result.unresolved++
      setCardHidden(card, false)
      result.shown++
      continue
    }
    if (resolved.source === 'json') result.fromJson++
    else result.fromDom++
    const s = resolved.summary
    const fp = filterPrice(s, filters.priceBasis)
    if (fp === null) result.noPrice++
    else if (fp.basis === 'listed') result.listedOnly++
    if (s.rating === null) result.noRating++

    guarded('renderRatingBadge', () => {
      renderRatingBadge(card, s)
    })
    guarded('renderPerNight', () => {
      renderPerNight(card, s)
    })

    const hide = active && !passesFilters(s, filters)
    guarded('setCardHidden', () => {
      setCardHidden(card, hide)
    })
    if (hide) result.hidden++
    else result.shown++
  }

  log.info('search augmented', result)
  return result
}

/** Undo everything this module did on the page (used when Lens is switched off). */
export function teardownSearchPage(root: ParentNode = document): void {
  for (const n of Array.from(root.querySelectorAll('[data-lens-badge], [data-lens-price]')))
    n.remove()
  for (const n of Array.from(root.querySelectorAll(`[${HIDE_ORIGINAL}]`)))
    n.removeAttribute(HIDE_ORIGINAL)
  for (const n of Array.from(root.querySelectorAll<HTMLElement>(`[${HIDDEN}]`))) {
    n.removeAttribute(HIDDEN)
    n.style.removeProperty('display')
  }
}
