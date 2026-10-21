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
 *         // OrderedDisplayPriceLine (seen 2026-10-21 on a no-dates USD page)
 *         | { accessibilityLabel: '$909 for 5 nights',
 *             orderedComponents: [{ discountedPrice | price: '$909' }, { qualifier: 'for 5 nights' }] },
 *       secondaryLine: null | { price: ... },
 *       explanationData: { priceDetails: [{ items: [{ description: '4 nights x RM 584.77' }] }] }
 *     }
 *   }
 */
import { findObjects, isObject } from './embedded'
import { nightsFromQualifier, parseMoney, perNight, type Money } from './price'
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
export function parsePriceLine(line: Record<string, unknown>): {
  total: Money | null
  nights: number | null
} {
  let priceText = str(line.discountedPrice) ?? str(line.price)
  let qualifier = str(line.qualifier)

  const components = Array.isArray(line.orderedComponents) ? line.orderedComponents : []
  for (const c of components) {
    if (!isObject(c)) continue
    priceText ??= str(c.discountedPrice) ?? str(c.price)
    qualifier ??= str(c.qualifier)
  }

  let n = nightsFromQualifier(qualifier)
  if (priceText && n !== undefined) {
    const total = parseMoney(priceText) ?? null
    return { total, nights: total ? n : null }
  }

  // Last resort: the accessible label carries both ("$909 for 5 nights, originally $1,100").
  const label = str(line.accessibilityLabel)
  const m = label ? /^(.+?)\s+for\s+(\d+)\s+nights?\b/i.exec(label) : null
  if (m) {
    n = nightsFromQualifier(`${m[2]} nights`)
    const total = parseMoney(m[1]) ?? null
    if (total && n !== undefined) return { total, nights: n }
  }
  return { total: null, nights: null }
}

export function summarizeSearchResult(o: Record<string, unknown>): ListingSummary | null {
  const listing = isObject(o.demandStayListing) ? o.demandStayListing : undefined
  const id = decodeListingId(listing?.id ?? o.listingId ?? o.id)
  if (!id) return null

  const { rating, reviews } = parseRatingText(
    str(o.avgRatingLocalized) ?? str(o.avgRatingA11yLabel),
  )
  const badges = badgeTexts(o)

  const sdp = isObject(o.structuredDisplayPrice) ? o.structuredDisplayPrice : undefined
  const primary = sdp && isObject(sdp.primaryLine) ? sdp.primaryLine : undefined
  const { total, nights } = primary ? parsePriceLine(primary) : { total: null, nights: null }

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
  }
}

/** Every listing summary found anywhere in a parsed embedded-state tree. De-duplicated by id. */
export function extractSearchResults(root: unknown): ListingSummary[] {
  const seen = new Set<string>()
  const out: ListingSummary[] = []
  for (const o of findObjects(root, looksLikeSearchResult)) {
    const s = summarizeSearchResult(o)
    if (s && !seen.has(s.id)) {
      seen.add(s.id)
      out.push(s)
    }
  }
  return out
}
