import { describe, expect, it } from 'vitest'
import { filterReasons, filtersActive, passesFilters } from './filter'
import type { ListingSummary } from './listing'
import { DEFAULT_FILTERS } from './settings'

const base: ListingSummary = {
  id: '1',
  title: 't',
  rating: 4.7,
  reviews: 20,
  superhost: false,
  guestFavorite: false,
  total: { amount: 2000, currency: '$' },
  nights: 4,
  perNight: 500,
}

describe('filters', () => {
  it('passes everything when no filters are set', () => {
    expect(filtersActive(DEFAULT_FILTERS)).toBe(false)
    expect(passesFilters(base, DEFAULT_FILTERS)).toBe(true)
  })
  it('applies each filter', () => {
    expect(filterReasons(base, { ...DEFAULT_FILTERS, minRating: 4.8 })).toEqual(['rating'])
    expect(filterReasons(base, { ...DEFAULT_FILTERS, minRating: 4.7 })).toEqual([])
    expect(filterReasons(base, { ...DEFAULT_FILTERS, minReviews: 21 })).toEqual(['reviews'])
    expect(filterReasons(base, { ...DEFAULT_FILTERS, maxNightly: 499 })).toEqual(['price'])
    expect(filterReasons(base, { ...DEFAULT_FILTERS, maxNightly: 500 })).toEqual([])
    expect(filterReasons(base, { ...DEFAULT_FILTERS, superhostOnly: true })).toEqual(['superhost'])
    expect(
      filterReasons({ ...base, superhost: true }, { ...DEFAULT_FILTERS, superhostOnly: true }),
    ).toEqual([])
  })
  it('never hides on unknown data except via hideUnrated', () => {
    const unknown = {
      ...base,
      rating: null,
      reviews: null,
      perNight: null,
      total: null,
      nights: null,
    }
    expect(
      passesFilters(unknown, {
        ...DEFAULT_FILTERS,
        minRating: 4.9,
        minReviews: 100,
        maxNightly: 1,
      }),
    ).toBe(true)
    expect(filterReasons(unknown, { ...DEFAULT_FILTERS, hideUnrated: true })).toEqual(['unrated'])
  })
})
