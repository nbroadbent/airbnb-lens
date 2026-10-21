/**
 * Turn Airbnb's embedded search-result objects into a small, stable summary the
 * rest of the extension works with. Shape verified against
 * fixtures/search-ssr.html on 2026-10-21:
 *
 *   {
 *     __typename: 'StaySearchResult',
 *     avgRatingLocalized: '4.96 (49)' | 'New' | null,
 *     avgRatingA11yLabel: '4.96 out of 5 average rating,  49 reviews',
 *     badges: [{ text: 'Guest favorite' | 'Superhost', ... }],
 *     title: 'Apartment in Waikiki',
 *     demandStayListing: { id: base64('DemandStayListing:<numeric id>') },
 *     structuredDisplayPrice: {
 *       displayPriceStyle: 'TOTAL_ONLY' | ...,
 *       primaryLine:
 *         // QualifiedDisplayPriceLine / DiscountedDisplayPriceLine
 *         { price | discountedPrice: 'RM 2,340', qualifier: 'for 4 nights', accessibilityLabel: 'RM 2,340 for 4 nights' }
 *         // REGULATED_TOTAL (Canada, 2026-10-21): { price: '$926 CAD', qualifier: 'total' } — nights only in
 *         //   explanationData ("4 nights x $201.51 CAD") or the URL dates
 *         // OrderedDisplayPriceLine (seen 2026-10-21 on a no-dates USD page)
 *         | { accessibilityLabel: '$909 for 5 nights',
 *             orderedComponents: [{ discountedPrice | price: '$909' }, { qualifier: 'for 5 nights' }] },
 *       secondaryLine: null | { price: ... },
 *       explanationData: { priceDetails: [{ items: [{ description: '4 nights x RM 584.77' }] }] }
 *     }
 *   }
 */
import { findObjects, isObject } from './embedded'
import {
  nightlyRateFromBreakdown,
  nightsFromBreakdown,
  nightsFromQualifier,
  parseMoney,
  perNight,
  type Money,
} from './price'
import type { PriceBasis } from './settings'
import { parseRatingText } from './rating'

export interface ListingSummary {
  /** Numeric Airbnb listing id as a string (matches /rooms/<id>). */
  id: string
  title: string | null
  rating: number | null
  reviews: number | null
  superhost: boolean
  guestFavorite: boolean
  /** Displayed total for the stay, if the price line is a total. */
  total: Money | null
  nights: number | null
  /** total ÷ nights, whole units. null when either is unknown. */
  perNight: number | null
  /** The listed nightly rate when Airbnb shows no stay total ("$150 night"). Fees not included. */
  nightlyBase: Money | null
}

export interface PriceFigure {
  amount: number
  basis: 'all-in' | 'listed' | 'nightly'
}

/**
 * The per-night figure the price filter compares against.
 *   all-in:  total ÷ nights; if no total is shown, the listed nightly rate (which
 *            can only go up once fees are added, so hiding on it is safe).
 *   nightly: the rate before fees; null when unknown (no inference possible).
 */
export function filterPrice(l: ListingSummary, basis: PriceBasis = 'all-in'): PriceFigure | null {
  if (basis === 'nightly') {
    return l.nightlyBase ? { amount: l.nightlyBase.amount, basis: 'nightly' } : null
  }
  if (l.perNight !== null) return { amount: l.perNight, basis: 'all-in' }
  if (l.nightlyBase) return { amount: l.nightlyBase.amount, basis: 'listed' }
  return null
}

export function looksLikeSearchResult(o: Record<string, unknown>): boolean {
  if (o.__typename === 'StaySearchResult') return true
  return 'avgRatingLocalized' in o && 'structuredDisplayPrice' in o && 'demandStayListing' in o
}

/** base64("DemandStayListing:123") → "123". Also accepts a bare numeric id. */
export function decodeListingId(raw: unknown): string | null {
  if (typeof raw === 'number') return String(raw)
  if (typeof raw !== 'string' || raw === '') return null
  if (/^\d+$/.test(raw)) return raw
  try {
    const decoded = atob(raw)
    const m = /:(\d+)$/.exec(decoded)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function badgeTexts(o: Record<string, unknown>): string[] {
  const badges = o.badges
  if (!Array.isArray(badges)) return []
  return badges
    .map((b) => (isObject(b) ? (str(b.text) ?? str(b.textAccessibilityLabel)) : null))
    .filter((t): t is string => t !== null)
    .map((t) => t.toLowerCase())
}

/**
 * Read a stay total and night count from any of the price-line shapes we know.
 * Order: explicit fields → orderedComponents → accessibilityLabel text. Returns
 * nulls when only a nightly rate is shown (no "for N nights" anywhere).
 */
export interface ParsedPriceLine {
  total: Money | null
  nights: number | null
  nightlyBase: Money | null
  /** True when the line is a stay total whose night count must come from elsewhere. */
  totalNeedsNights?: boolean
}

export interface SummarizeOptions {
  /** Nights implied by the page URL (checkin/checkout), used when a total line has no count. */
  nightsHint?: number | undefined
}

const NIGHTLY_RE = /^(.+?)\s*(?:per|\/|\u00b7)?\s*night$/i

export function parsePriceLine(line: Record<string, unknown>): ParsedPriceLine {
  let priceText = str(line.discountedPrice) ?? str(line.price)
  let qualifier = str(line.qualifier)

  const components = Array.isArray(line.orderedComponents) ? line.orderedComponents : []
  for (const c of components) {
    if (!isObject(c)) continue
    priceText ??= str(c.discountedPrice) ?? str(c.price)
    qualifier ??= str(c.qualifier)
  }

  const none: ParsedPriceLine = { total: null, nights: null, nightlyBase: null }
  let n = nightsFromQualifier(qualifier)
  if (priceText && n !== undefined) {
    const total = parseMoney(priceText) ?? null
    return { ...none, total, nights: total ? n : null }
  }

  // Stay total in the accessible label ("$909 for 5 nights, originally $1,100").
  const label = str(line.accessibilityLabel)
  const m = label ? /^(.+?)\s+for\s+(\d+)\s+nights?\b/i.exec(label) : null
  if (m) {
    n = nightsFromQualifier(`${m[2]} nights`)
    const total = parseMoney(m[1]) ?? null
    if (total && n !== undefined) return { ...none, total, nights: n }
  }

  // Stay total with no night count on the line ("$926 CAD", qualifier "total").
  if (priceText && qualifier && /^total$/i.test(qualifier.trim())) {
    const total = parseMoney(priceText) ?? null
    return { ...none, total, totalNeedsNights: total !== null }
  }
  const tm = label ? /^(.+?)\s+total$/i.exec(label) : null
  if (tm) {
    const total = parseMoney(tm[1]) ?? null
    return { ...none, total, totalNeedsNights: total !== null }
  }

  // Nightly rate only ("$150", qualifier "night" / label "$150 per night").
  if (priceText && qualifier && /^(?:per\s+)?night$/i.test(qualifier.trim())) {
    return { ...none, nightlyBase: parseMoney(priceText) ?? null }
  }
  const nm = label ? NIGHTLY_RE.exec(label) : null
  if (nm) return { ...none, nightlyBase: parseMoney(nm[1]) ?? null }
  return none
}

/** First "N nights x …" description anywhere in explanationData.priceDetails. */
export function breakdownLine(sdp: Record<string, unknown> | undefined): string | undefined {
  const ex = sdp && isObject(sdp.explanationData) ? sdp.explanationData : undefined
  const groups = ex && Array.isArray(ex.priceDetails) ? ex.priceDetails : []
  for (const g of groups) {
    const items = isObject(g) && Array.isArray(g.items) ? g.items : []
    for (const it of items) {
      const d = isObject(it) ? str(it.description) : null
      if (d && nightsFromBreakdown(d) !== undefined) return d
    }
  }
  return undefined
}

export function nightsFromExplanation(
  sdp: Record<string, unknown> | undefined,
): number | undefined {
  return nightsFromBreakdown(breakdownLine(sdp))
}

export function summarizeSearchResult(
  o: Record<string, unknown>,
  opts: SummarizeOptions = {},
): ListingSummary | null {
  const listing = isObject(o.demandStayListing) ? o.demandStayListing : undefined
  const id = decodeListingId(listing?.id ?? o.listingId ?? o.id)
  if (!id) return null

  const { rating, reviews } = parseRatingText(
    str(o.avgRatingLocalized) ?? str(o.avgRatingA11yLabel),
  )
  const badges = badgeTexts(o)

  const sdp = isObject(o.structuredDisplayPrice) ? o.structuredDisplayPrice : undefined
  const primary = sdp && isObject(sdp.primaryLine) ? sdp.primaryLine : undefined
  const parsed: ParsedPriceLine = primary
    ? parsePriceLine(primary)
    : { total: null, nights: null, nightlyBase: null }
  const { total } = parsed
  let nights = parsed.nights
  const breakdown = breakdownLine(sdp)
  if (parsed.totalNeedsNights && nights === null) {
    nights = nightsFromBreakdown(breakdown) ?? opts.nightsHint ?? null
  }
  // Pre-fee nightly rate: breakdown line wins; a nightly-only price line is the fallback.
  const nightlyBase: Money | null = nightlyRateFromBreakdown(breakdown) ?? parsed.nightlyBase

  return {
    id,
    title: str(o.title) ?? str(o.subtitle),
    rating,
    reviews,
    superhost: badges.some((b) => b.includes('superhost')),
    guestFavorite: badges.some((b) => b.includes('guest favorite')),
    total,
    nights,
    perNight: total && nights ? (perNight(total.amount, nights) ?? null) : null,
    nightlyBase,
  }
}

/** Every listing summary found anywhere in a parsed embedded-state tree. De-duplicated by id. */
export function extractSearchResults(root: unknown, opts: SummarizeOptions = {}): ListingSummary[] {
  const seen = new Set<string>()
  const out: ListingSummary[] = []
  for (const o of findObjects(root, looksLikeSearchResult)) {
    const s = summarizeSearchResult(o, opts)
    if (s && !seen.has(s.id)) {
      seen.add(s.id)
      out.push(s)
    }
  }
  return out
}
