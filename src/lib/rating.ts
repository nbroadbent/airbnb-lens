/**
 * Rating calibration. Airbnb's median listing rating is ~4.8, so a bare "4.7"
 * reads as great when it is actually below average. Tiers per spec.
 */

export type RatingTier = 'above' | 'average' | 'below' | 'well-below' | 'new'

export interface Calibrated {
  tier: RatingTier
  label: string
  /** CSS colour token name; styles live in lens.css. */
  color: 'green' | 'grey' | 'amber' | 'red' | 'blue'
  /** True when the review count is too small to trust (< 10). */
  lowConfidence: boolean
}

export const LOW_CONFIDENCE_REVIEWS = 10

export function calibrateRating(rating: number | null, reviewCount: number | null): Calibrated {
  const lowConfidence = reviewCount !== null && reviewCount < LOW_CONFIDENCE_REVIEWS
  if (rating === null || !Number.isFinite(rating)) {
    return { tier: 'new', label: 'new', color: 'blue', lowConfidence: true }
  }
  // Plain thresholds on the displayed value: 4.85 is still "average", 4.56 is already red.
  const r = rating
  if (r >= 4.9) return { tier: 'above', label: 'above avg', color: 'green', lowConfidence }
  if (r >= 4.8) return { tier: 'average', label: 'average', color: 'grey', lowConfidence }
  if (r >= 4.6) return { tier: 'below', label: 'below avg', color: 'amber', lowConfidence }
  return { tier: 'well-below', label: 'well below avg', color: 'red', lowConfidence }
}

/**
 * Parse Airbnb's localized rating text. Verified shapes (2026-10-21):
 *   "4.96 (49)"  → rating 4.96, reviews 49
 *   "5.0 (7)"    → 5.0, 7
 *   "New"        → null, null   (unrated listing)
 * Also tolerates "4,96 (49)" (comma decimal) and "4.96 · 49 reviews".
 */
export function parseRatingText(text: string | null | undefined): {
  rating: number | null
  reviews: number | null
} {
  if (!text) return { rating: null, reviews: null }
  const t = text.replace(/\u00a0/g, ' ').trim()
  const m = /^(\d)[.,](\d{1,2})\b/.exec(t)
  if (!m) return { rating: null, reviews: null }
  const rating = Number(`${m[1]}.${m[2]}`)
  const c = /\(?\s*([\d.,]+)\s*\)?\s*(reviews?)?\s*$/i.exec(t.slice(m[0].length))
  let reviews: number | null = null
  if (c?.[1]) {
    const n = Number(c[1].replace(/[.,]/g, ''))
    reviews = Number.isFinite(n) ? n : null
  }
  return { rating: rating >= 0 && rating <= 5 ? rating : null, reviews }
}
