/**
 * DOM-side card access: find cards, identify them, and (as a FALLBACK when the
 * embedded JSON has no entry for a card — e.g. after client-side pagination) read
 * rating / price / Superhost straight from the card's text.
 */
import type { ListingSummary } from '../lib/listing'
import { nightsFromQualifier, parseMoney, perNight } from '../lib/price'
import { parseRatingText } from '../lib/rating'
import { patterns, q, qAll, selectors } from '../selectors'

export function findCards(root: ParentNode = document): HTMLElement[] {
  return qAll<HTMLElement>('card', root)
}

/** Numeric listing id from any /rooms/<id> link in the card. */
export function cardId(card: Element): string | null {
  for (const a of qAll<HTMLAnchorElement>('cardLink', card)) {
    const m = patterns.roomId.exec(a.getAttribute('href') ?? '')
    if (m?.[1]) return m[1]
  }
  return null
}

/**
 * The element we hide when filtering: the grid cell. Found structurally — walk up
 * from the card until the parent holds more than one card; the node just below
 * that parent is the cell. Hiding anything lower leaves an empty gap in the grid.
 */
export function cardHideTarget(card: HTMLElement): HTMLElement {
  const cardCss = selectors.card.css
  let node: HTMLElement = card
  for (let depth = 0; depth < 12; depth++) {
    const parent = node.parentElement
    if (!parent || parent === card.ownerDocument.body) break
    if (parent.querySelectorAll(cardCss).length > 1) return node
    node = parent
  }
  return card.closest<HTMLElement>(selectors.cardWrapper.css) ?? card
}

function leafText(el: Element): string {
  return (el.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The visible "4.96 (49)" span, found by text pattern. */
export function findRatingDisplay(card: Element): HTMLElement | null {
  for (const span of qAll<HTMLElement>('ratingDisplay', card)) {
    if (span.children.length === 0 && patterns.ratingDisplay.test(leafText(span))) return span
  }
  return null
}

/** Any element in the card whose whole text is exactly "Superhost". */
export function hasSuperhostBadge(card: Element): boolean {
  for (const el of Array.from(card.querySelectorAll('span, div'))) {
    if (el.children.length === 0 && patterns.superhost.test(leafText(el))) return true
  }
  return false
}

/** Leaf span like "RM 2,340 for 4 nights" inside the price row. */
export function findPriceForNights(card: Element): { text: string; el: HTMLElement } | null {
  const row = q<HTMLElement>('priceRow', card)
  if (!row) return null
  for (const span of Array.from(row.querySelectorAll<HTMLElement>('span'))) {
    if (span.children.length !== 0) continue
    const t = leafText(span)
    if (patterns.priceForNights.test(t)) return { text: t, el: span }
  }
  return null
}

/** Build a summary from the card's DOM alone. Null if we can't even find an id. */
export function readCardFromDom(card: HTMLElement): ListingSummary | null {
  const id = cardId(card)
  if (!id) return null

  const ratingEl = findRatingDisplay(card)
  const { rating, reviews } = parseRatingText(ratingEl ? leafText(ratingEl) : null)

  let total: ListingSummary['total'] = null
  let nights: number | null = null
  const price = findPriceForNights(card)
  if (price) {
    const m = patterns.priceForNights.exec(price.text)
    const money = parseMoney(m?.[1])
    const n = m?.[2] !== undefined ? nightsFromQualifier(`${m[2]} nights`) : undefined
    if (money && n !== undefined) {
      total = money
      nights = n
    }
  }

  return {
    id,
    title: leafText(q('cardTitle', card) ?? card).slice(0, 120) || null,
    rating,
    reviews,
    superhost: hasSuperhostBadge(card),
    guestFavorite: false,
    total,
    nights,
    perNight: total && nights ? (perNight(total.amount, nights) ?? null) : null,
  }
}
