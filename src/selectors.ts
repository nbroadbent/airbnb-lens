/**
 * EVERY DOM selector used by Airbnb Lens lives in this file.
 *
 * Airbnb's class names are obfuscated and change on every deploy, so nothing in
 * here may reference a class name. Allowed anchors, in order of preference:
 *   1. embedded JSON (`<script id="data-deferred-state-0">`)
 *   2. `data-testid` attributes
 *   3. ARIA roles / labels, schema.org itemprops
 *   4. text-content patterns (see the regexes at the bottom)
 *
 * Each entry documents what it targets and the date it was last verified against
 * a real page or a saved fixture. Keep SELECTOR_AUDIT.md in sync.
 *
 * Status legend:
 *   VERIFIED   - checked against fixtures/*.html or a live page on the given date
 *   UNVERIFIED - taken from the spec or memory; must be confirmed before any
 *                feature depends on it
 */

export interface SelectorEntry {
  css: string
  targets: string
  status: 'VERIFIED' | 'UNVERIFIED'
  verified: string
  howToVerify: string
}

export const selectors = {
  mountRoot: {
    css: 'body',
    targets: 'Document body; host for all Lens-owned floating UI',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify: 'Always present.',
  },

  /** Airbnb's server-rendered state blob — PRIMARY data source. */
  deferredStateScript: {
    css: 'script[id^="data-deferred-state"]',
    targets: 'Embedded JSON ("niobeClientData") holding the first page of search results',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify:
      'Search page: document.querySelectorAll(css).length >= 1, and JSON.parse(el.textContent).niobeClientData exists. Fixture: fixtures/search-ssr.html',
  },

  /** Schema.org structured data, if present. Not yet used. */
  ldJsonScript: {
    css: 'script[type="application/ld+json"]',
    targets: 'Schema.org JSON-LD blocks',
    status: 'UNVERIFIED',
    verified: '2026-10-21',
    howToVerify: 'document.querySelectorAll(css) on a listing page; expect >= 1.',
  },

  /** One search-result card (role="group"). */
  card: {
    css: '[data-testid="card-container"]',
    targets: 'Each listing card on the search results grid',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify:
      'Search page: document.querySelectorAll(css).length equals visible cards (18–24). Fixture: fixtures/search.html',
  },

  /** The grid cell wrapping a card; what we hide when filtering so no gap remains. */
  cardWrapper: {
    css: '[itemprop="itemListElement"]',
    targets: 'schema.org ListItem wrapper around each card (contains <meta itemprop="url">)',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify: 'card.closest(css) is non-null for every card.',
  },

  /** Any link to the listing inside a card; the href carries the numeric id. */
  cardLink: {
    css: 'a[href*="/rooms/"]',
    targets: 'Listing links inside a card (several per card; all share the id)',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify: 'card.querySelector(css).getAttribute("href") matches /\\/rooms\\/(\\d+)/',
  },

  cardTitle: {
    css: '[data-testid="listing-card-title"]',
    targets: 'Card title line, e.g. "Apartment in Waikiki". Badge falls back to after this.',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify: 'One per card.',
  },

  /** Rating is NOT testid-tagged. We find it by text pattern (see RATING_DISPLAY_RE). */
  ratingDisplay: {
    css: 'span[aria-hidden="true"]',
    targets:
      'Candidate spans; the one whose text matches RATING_DISPLAY_RE ("4.96 (49)") is the rating. Its sibling span carries "4.96 out of 5 average rating, 49 reviews".',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify:
      '[...card.querySelectorAll(css)].some(s => /^\\d\\.\\d{1,2} \\(\\d+\\)$/.test(s.textContent.trim()))',
  },

  priceRow: {
    css: '[data-testid="price-availability-row"]',
    targets:
      'Price block. Contains a leaf <span> "RM 2,340 for 4 nights" (a11y text) when dates are set.',
    status: 'VERIFIED',
    verified: '2026-10-21',
    howToVerify:
      'One per card; textContent includes the total and "for N nights" when dates are set.',
  },
} as const satisfies Record<string, SelectorEntry>

export type SelectorName = keyof typeof selectors

/** Text patterns (verified 2026-10-21 against fixtures/search.html). */
export const patterns = {
  /** "4.96 (49)", "5.0 (7)" — the visible rating + review count. */
  ratingDisplay: /^(\d[.,]\d{1,2})\s*\((\d[\d.,]*)\)$/,
  /** "4.96 out of 5 average rating,  49 reviews" — the a11y twin of the above. */
  ratingA11y: /(\d[.,]\d{1,2}) out of 5 average rating,\s*(\d[\d.,]*) reviews?/i,
  /** "RM 2,340 for 4 nights" or "RM 1,919 for 4 nights, originally RM 2,264" — a11y price line. */
  priceForNights: /^(.+?)\s+for\s+(\d+)\s+nights?(?:,.*)?$/i,
  /** "$926 CAD total" — regulated-total style (Canada); nights are NOT on the line. Verified 2026-10-21 (fixtures/search-cad-regulated.html). */
  priceTotalOnly: /^(.+?)\s+total$/i,
  /** "$150 night", "$150 per night", "$150 / night" — base nightly rate when no stay total is shown (shape from spec; UNVERIFIED in DOM). */
  priceNightly: /^(.+?)\s*(?:per|\/|\u00b7)?\s*night$/i,
  /** Exact badge text in the card's image overlay. */
  superhost: /^superhost$/i,
  /** Unrated listings show this instead of a rating (shape from the spec; DOM form UNVERIFIED). */
  newListing: /^new$/i,
  /** Numeric id in a listing URL. */
  roomId: /\/rooms\/(?:plus\/)?(\d+)/,
} as const

export function q<T extends Element = Element>(
  name: SelectorName,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selectors[name].css)
}

export function qAll<T extends Element = Element>(
  name: SelectorName,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selectors[name].css))
}
