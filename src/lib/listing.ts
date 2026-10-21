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
 *       primaryLine: { price | discountedPrice: 'RM 2,340', qualifier: 'for 4 nights' },
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

export function summarizeSearchResult(o: Record<string, unknown>): ListingSummary | null {
  const listing = isObject(o.demandStayListing) ? o.demandStayListing : undefined
  const id = decodeListingId(listing?.id ?? o.listingId ?? o.id)
  if (!id) return null

  const { rating, reviews } = parseRatingText(
    str(o.avgRatingLocalized) ?? str(o.avgRatingA11yLabel),
  )
  const badges = badgeTexts(o)

  let total: Money | null = null
  let nights: number | null = null
  const sdp = isObject(o.structuredDisplayPrice) ? o.structuredDisplayPrice : undefined
  const primary = sdp && isObject(sdp.primaryLine) ? sdp.primaryLine : undefined
  if (primary) {
    const priceText = str(primary.discountedPrice) ?? str(primary.price)
    const qualifier = str(primary.qualifier) ?? str(primary.accessibilityLabel)
    const n = nightsFromQualifier(qualifier)
    if (priceText && n !== undefined) {
      total = parseMoney(priceText) ?? null
      nights = n
    }
  }

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
