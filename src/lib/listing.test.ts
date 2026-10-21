import { describe, expect, it } from 'vitest'
import { readEmbeddedState } from './embedded'
import { decodeListingId, extractSearchResults, summarizeSearchResult } from './listing'
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

describe('extractSearchResults against the SSR fixture', () => {
  const doc = loadFixture('search-ssr.html')
  const blobs = readEmbeddedState(doc)

  it('finds the embedded state', () => {
    expect(blobs.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts every listing with ratings and all-in prices', () => {
    const all = blobs.flatMap(extractSearchResults)
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
    expect(all.every((l) => l.perNight !== null)).toBe(true)
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length)
  })
})
