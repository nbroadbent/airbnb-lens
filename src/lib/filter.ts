import { filterPrice, type ListingSummary } from './listing'
import type { Filters } from './settings'

export type FilterReason = 'rating' | 'reviews' | 'price' | 'unrated' | 'superhost'

/**
 * Decide whether a listing passes the user's filters. Unknown data never fails a
 * numeric filter (we hide only what we can prove), except the explicit
 * "hide unrated" toggle which targets missing ratings on purpose.
 */
export function filterReasons(l: ListingSummary, f: Filters): FilterReason[] {
  const reasons: FilterReason[] = []
  if (f.hideUnrated && l.rating === null) reasons.push('unrated')
  if (f.minRating !== null && l.rating !== null && l.rating < f.minRating - 1e-9)
    reasons.push('rating')
  if (f.minReviews !== null && l.reviews !== null && l.reviews < f.minReviews)
    reasons.push('reviews')
  const price = filterPrice(l, f.priceBasis)
  if (f.maxNightly !== null && price !== null && price.amount > f.maxNightly) reasons.push('price')
  if (f.superhostOnly && !l.superhost) reasons.push('superhost')
  return reasons
}

export function passesFilters(l: ListingSummary, f: Filters): boolean {
  return filterReasons(l, f).length === 0
}

export function filtersActive(f: Filters): boolean {
  return (
    f.minRating !== null ||
    f.minReviews !== null ||
    f.maxNightly !== null ||
    f.hideUnrated ||
    f.superhostOnly
  )
}
