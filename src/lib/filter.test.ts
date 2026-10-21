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
  nightlyBase: null,
  monthly: null,
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
  it('uses the listed nightly rate when there is no all-in price', () => {
    const listed = {
      ...base,
      total: null,
      nights: null,
      perNight: null,
      nightlyBase: { amount: 150, currency: '$' },
    }
    expect(filterReasons(listed, { ...DEFAULT_FILTERS, maxNightly: 149 })).toEqual(['price'])
    expect(filterReasons(listed, { ...DEFAULT_FILTERS, maxNightly: 150 })).toEqual([])
    // all-in wins over listed when both exist
    expect(
      filterReasons({ ...listed, perNight: 200 }, { ...DEFAULT_FILTERS, maxNightly: 180 }),
    ).toEqual(['price'])
  })

  it('compares against the stay total when basis is total', () => {
    const l = { ...base, total: { amount: 2000, currency: '$' }, nights: 4, perNight: 500 }
    expect(filterReasons(l, { ...DEFAULT_FILTERS, maxNightly: 1999, priceBasis: 'total' })).toEqual(
      ['price'],
    )
    expect(filterReasons(l, { ...DEFAULT_FILTERS, maxNightly: 2000, priceBasis: 'total' })).toEqual(
      [],
    )
    expect(
      filterReasons(l, { ...DEFAULT_FILTERS, maxNightly: 499, priceBasis: 'nightly' }),
    ).toEqual(['price'])
    // total basis never infers from a nightly-only listing
    const nightlyOnly = {
      ...base,
      total: null,
      nights: null,
      perNight: null,
      nightlyBase: { amount: 150, currency: '$' },
    }
    expect(
      filterReasons(nightlyOnly, { ...DEFAULT_FILTERS, maxNightly: 100, priceBasis: 'total' }),
    ).toEqual([])
    expect(
      filterReasons(nightlyOnly, { ...DEFAULT_FILTERS, maxNightly: 100, priceBasis: 'nightly' }),
    ).toEqual(['price'])
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
