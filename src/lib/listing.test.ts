import { describe, expect, it } from 'vitest'
import { readEmbeddedState } from './embedded'
import {
  decodeListingId,
  extractSearchResults,
  parsePriceLine,
  summarizeSearchResult,
} from './listing'
import { loadFixture } from '../test/fixtures'

describe('decodeListingId', () => {
  it('decodes the base64 DemandStayListing id', () => {
    expect(decodeListingId('RGVtYW5kU3RheUxpc3Rpbmc6MTM5OTU0Mzg1MTg1Nzc4MjYyNA==')).toBe(
      '1399543851857782624',
    )
    expect(decodeListingId('48757963')).toBe('48757963')
    expect(decodeListingId(48757963)).toBe('48757963')
    expect(decodeListingId('')).toBeNull()
    expect(decodeListingId(null)).toBeNull()
  })
})

describe('summarizeSearchResult', () => {
  it('handles a discounted total and a Superhost badge', () => {
    const s = summarizeSearchResult({
      __typename: 'StaySearchResult',
      avgRatingLocalized: '4.87 (87)',
      badges: [{ text: 'Superhost' }],
      title: 'Condo in Honolulu',
      demandStayListing: { id: 'RGVtYW5kU3RheUxpc3Rpbmc6OTIyMTU0OTMyNjQ0MzQ4NTkz' },
      structuredDisplayPrice: {
        primaryLine: {
          discountedPrice: 'RM 1,919',
          originalPrice: 'RM 2,264',
          qualifier: 'for 4 nights',
        },
      },
    })
    expect(s).toMatchObject({
      id: '922154932644348593',
      rating: 4.87,
      reviews: 87,
      superhost: true,
      total: { amount: 1919, currency: 'RM' },
      nights: 4,
      perNight: 480,
    })
  })
  it('shows no price when only a nightly rate is displayed', () => {
    const s = summarizeSearchResult({
      __typename: 'StaySearchResult',
      avgRatingLocalized: 'New',
      demandStayListing: { id: '123' },
      structuredDisplayPrice: { primaryLine: { price: '$120', qualifier: 'night' } },
    })
    expect(s).toMatchObject({
      id: '123',
      rating: null,
      reviews: null,
      total: null,
      nights: null,
      perNight: null,
    })
  })
  it('returns null without an id', () => {
    expect(summarizeSearchResult({ __typename: 'StaySearchResult' })).toBeNull()
  })
})

describe('parsePriceLine shapes', () => {
  it('reads OrderedDisplayPriceLine components', () => {
    expect(
      parsePriceLine({
        __typename: 'OrderedDisplayPriceLine',
        accessibilityLabel: '$909 for 5 nights',
        orderedComponents: [{ discountedPrice: '$909' }, { qualifier: 'for 5 nights' }],
      }),
    ).toEqual({ total: { amount: 909, currency: '$' }, nights: 5, nightlyBase: null })
  })
  it('falls back to the accessibility label', () => {
    expect(
      parsePriceLine({ accessibilityLabel: '$1,100 for 2 nights, originally $1,300' }),
    ).toEqual({
      total: { amount: 1100, currency: '$' },
      nights: 2,
      nightlyBase: null,
    })
  })
  it('reads a nightly-only line as a listed base rate', () => {
    expect(
      parsePriceLine({ price: '$135', qualifier: 'night', accessibilityLabel: '$135 per night' }),
    ).toEqual({ total: null, nights: null, nightlyBase: { amount: 135, currency: '$' } })
    expect(parsePriceLine({ accessibilityLabel: '$135 per night' })).toEqual({
      total: null,
      nights: null,
      nightlyBase: { amount: 135, currency: '$' },
    })
    expect(
      parsePriceLine({
        __typename: 'OrderedDisplayPriceLine',
        orderedComponents: [{ discountedPrice: '$120' }, { qualifier: 'night' }],
      }).nightlyBase,
    ).toEqual({ amount: 120, currency: '$' })
  })
})

describe('regulated-total style (Canada)', () => {
  it('takes the total from the line and nights from the breakdown', () => {
    const s = summarizeSearchResult({
      __typename: 'StaySearchResult',
      avgRatingLocalized: '4.9 (12)',
      demandStayListing: { id: '7' },
      structuredDisplayPrice: {
        displayPriceStyle: 'REGULATED_TOTAL',
        primaryLine: {
          price: '$926 CAD',
          qualifier: 'total',
          accessibilityLabel: '$926 CAD total',
        },
        explanationData: {
          priceDetails: [
            { items: [{ description: '4 nights x $201.51 CAD' }, { description: 'Taxes' }] },
          ],
        },
      },
    })
    expect(s).toMatchObject({
      total: { amount: 926, currency: '$', suffix: 'CAD' },
      nights: 4,
      perNight: 232,
    })
  })
  it('falls back to the URL nights hint when the breakdown is absent', () => {
    const s = summarizeSearchResult(
      {
        __typename: 'StaySearchResult',
        demandStayListing: { id: '8' },
        structuredDisplayPrice: { primaryLine: { price: '$600 CAD', qualifier: 'total' } },
      },
      { nightsHint: 3 },
    )
    expect(s).toMatchObject({
      total: { amount: 600, currency: '$', suffix: 'CAD' },
      nights: 3,
      perNight: 200,
    })
    const noHint = summarizeSearchResult({
      __typename: 'StaySearchResult',
      demandStayListing: { id: '9' },
      structuredDisplayPrice: { primaryLine: { price: '$600 CAD', qualifier: 'total' } },
    })
    expect(noHint).toMatchObject({
      total: { amount: 600, currency: '$', suffix: 'CAD' },
      nights: null,
      perNight: null,
    })
  })
  it('prices every result in the CAD fixture', () => {
    const doc = loadFixture('search-cad-regulated.html')
    const all = readEmbeddedState(doc).flatMap((b) => extractSearchResults(b, { nightsHint: 4 }))
    expect(all.length).toBeGreaterThanOrEqual(18)
    expect(all.filter((l) => l.perNight === null).map((l) => l.id)).toEqual([])
    expect(all[0]?.total?.suffix).toBe('CAD')
  })
})

describe('extractSearchResults against the no-dates USD fixture', () => {
  it('gets a per-night price for every result, including OrderedDisplayPriceLine ones', () => {
    const doc = loadFixture('search-ssr-nodates-usd.html')
    const all = readEmbeddedState(doc).flatMap((b) => extractSearchResults(b))
    expect(all.length).toBeGreaterThanOrEqual(24)
    const missing = all.filter((l) => l.perNight === null)
    expect(missing.map((l) => l.id)).toEqual([])
    expect(all[0]?.total?.currency).toBe('$')
    expect(all.every((l) => l.nights === 5)).toBe(true)
  })
})

describe('extractSearchResults against the SSR fixture', () => {
  const doc = loadFixture('search-ssr.html')
  const blobs = readEmbeddedState(doc)

  it('finds the embedded state', () => {
    expect(blobs.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts every listing with ratings and all-in prices', () => {
    const all = blobs.flatMap((b) => extractSearchResults(b))
    // 18 grid results plus a few more StaySearchResult objects elsewhere in the blob (map/other sections).
    expect(all.length).toBeGreaterThanOrEqual(18)
    expect(all[0]).toMatchObject({
      id: '1399543851857782624',
      title: 'Apartment in Waikiki',
      rating: 4.96,
      reviews: 49,
      superhost: false,
      guestFavorite: true,
      total: { amount: 2340, currency: 'RM' },
      nights: 4,
      perNight: 585,
    })
    expect(all.filter((l) => l.superhost).length).toBeGreaterThanOrEqual(4)
    expect(all[0]?.nightlyBase).toEqual({ amount: 584.77, currency: 'RM' })
    expect(all.every((l) => l.nightlyBase !== null)).toBe(true)
    expect(all.every((l) => l.perNight !== null)).toBe(true)
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length)
  })
})
