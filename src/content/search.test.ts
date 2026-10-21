import { beforeEach, describe, expect, it } from 'vitest'
import {
  cardId,
  findCards,
  findPriceForNights,
  findRatingDisplay,
  hasSuperhostBadge,
  readCardFromDom,
} from './cards'
import { augmentSearchPage, collectDiagnostics, listingIndex, teardownSearchPage } from './search'
import { DEFAULT_FILTERS } from '../lib/settings'
import { loadFixture } from '../test/fixtures'

describe('card DOM reading (fixtures/search.html)', () => {
  const doc = loadFixture('search.html')
  const cards = findCards(doc)

  it('finds the cards and their ids', () => {
    expect(cards.length).toBe(24)
    const ids = cards.map(cardId)
    expect(ids.every((id) => id !== null && /^\d+$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(24)
    expect(ids[0]).toBe('1399543851857782624')
  })

  it('reads rating, price and Superhost from the DOM alone', () => {
    const first = cards[0]
    if (!first) throw new Error('no card')
    expect(findRatingDisplay(first)?.textContent?.trim()).toBe('4.96 (49)')
    expect(findPriceForNights(first)?.text).toBe('RM 2,340 for 4 nights')
    expect(readCardFromDom(first)).toMatchObject({
      id: '1399543851857782624',
      title: 'Apartment in Waikiki',
      rating: 4.96,
      reviews: 49,
      total: { amount: 2340, currency: 'RM' },
      nights: 4,
      perNight: 585,
    })
    expect(cards.filter(hasSuperhostBadge).length).toBeGreaterThan(0)
    expect(
      cards.map(readCardFromDom).every((s) => s && s.rating !== null && s.perNight !== null),
    ).toBe(true)
  })

  it('agrees with the embedded JSON for every card', () => {
    const index = listingIndex(doc)
    expect(index.size).toBeGreaterThanOrEqual(24)
    for (const card of cards) {
      const dom = readCardFromDom(card)
      const json = dom ? index.get(dom.id) : undefined
      expect(json, `json entry for ${dom?.id}`).toBeDefined()
      expect(dom?.rating).toBe(json?.rating)
      expect(dom?.reviews).toBe(json?.reviews)
      expect(dom?.perNight).toBe(json?.perNight)
      expect(dom?.superhost).toBe(json?.superhost)
    }
  })
})

describe('CAD regulated-total page (fixtures/search-cad-regulated.html)', () => {
  it('prices every card from JSON and from the DOM alone, and filters on it', () => {
    const doc = loadFixture('search-cad-regulated.html')
    const cards = findCards(doc)
    expect(cards.length).toBeGreaterThanOrEqual(18)
    for (const card of cards) {
      const dom = readCardFromDom(card, 4)
      expect(dom?.perNight, `dom price for ${dom?.id}`).not.toBeNull()
      expect(dom?.total?.suffix).toBe('CAD')
    }
    const r = augmentSearchPage({ ...DEFAULT_FILTERS, maxNightly: 230 }, doc)
    expect(r.fromJson).toBe(cards.length)
    expect(r.noPrice).toBe(0)
    expect(r.hidden).toBeGreaterThan(0)
    expect(r.shown).toBeGreaterThan(0)
    expect(cards[0]?.querySelector('[data-lens-price]')?.textContent).toBe('$232 CAD/night all-in')
    expect(cards[0]?.querySelector<HTMLElement>('[data-lens-price]')?.title).toContain(
      '$202 CAD/night before fees',
    )

    // First card: $926 CAD total, $232/night. A 900 total cap hides it; a 900 per-night cap does not.
    const byTotal = augmentSearchPage(
      { ...DEFAULT_FILTERS, maxNightly: 900, priceBasis: 'total' },
      doc,
    )
    expect(byTotal.noPrice).toBe(0)
    expect(cards[0]?.closest('[data-lens-hidden]')).not.toBeNull()
    expect(byTotal.hidden).toBeGreaterThan(0)
    const byNight = augmentSearchPage(
      { ...DEFAULT_FILTERS, maxNightly: 900, priceBasis: 'nightly' },
      doc,
    )
    expect(cards[0]?.closest('[data-lens-hidden]')).toBeNull()
    expect(byNight.hidden).toBe(0)
  })
})

describe('collectDiagnostics', () => {
  it('reports what Lens sees, problem cards first', () => {
    const doc = loadFixture('search-cad-regulated.html')
    augmentSearchPage(DEFAULT_FILTERS, doc)
    const d = collectDiagnostics(doc)
    expect(d.lastResult?.total).toBeGreaterThan(0)
    expect(d.nightsHint).toBe(4)
    expect(d.embeddedStateScripts).toBeGreaterThan(0)
    expect(d.cards.length).toBeLessThanOrEqual(6)
    expect(d.cards[0]).toMatchObject({ source: 'json', nights: 4 })
    expect(d.cards[0]?.priceRowText).toContain('CAD total')
    expect(d.cards[0]?.jsonPrice).toMatchObject({ displayPriceStyle: 'REGULATED_TOTAL' })
  })
})

describe('DOM fallback for nightly-only cards', () => {
  it('reads "$150 night" as a listed rate and filters on it', () => {
    document.body.innerHTML = `
      <div itemprop="itemListElement"><div data-testid="card-container">
        <a href="/rooms/42?x=1">x</a>
        <div data-testid="listing-card-title">Cabin</div>
        <div data-testid="price-availability-row"><span><span>$150</span><span> night</span></span><span>$150 per night</span></div>
      </div></div>
      <div itemprop="itemListElement"><div data-testid="card-container">
        <a href="/rooms/43?x=1">x</a>
        <div data-testid="listing-card-title">Loft</div>
        <div data-testid="price-availability-row"><span>$95 night</span></div>
      </div></div>`
    const cards = findCards(document)
    expect(readCardFromDom(cards[0] as HTMLElement)).toMatchObject({
      id: '42',
      perNight: null,
      nightlyBase: { amount: 150, currency: '$' },
    })
    const r = augmentSearchPage({ ...DEFAULT_FILTERS, maxNightly: 100 }, document)
    expect(r).toMatchObject({
      total: 2,
      hidden: 1,
      shown: 1,
      listedOnly: 2,
      noPrice: 0,
      fromDom: 2,
    })
    expect(document.querySelectorAll('[data-lens-price]')).toHaveLength(0) // no all-in label without a total
    teardownSearchPage(document)
    document.body.innerHTML = ''
  })
})

describe('augmentSearchPage', () => {
  let doc: Document
  beforeEach(() => {
    doc = loadFixture('search.html')
  })

  it('injects a badge and per-night price into every card, idempotently', () => {
    const r1 = augmentSearchPage(DEFAULT_FILTERS, doc)
    expect(r1).toMatchObject({
      total: 24,
      shown: 24,
      hidden: 0,
      fromJson: 24,
      fromDom: 0,
      unresolved: 0,
    })
    expect(doc.querySelectorAll('[data-lens-badge]')).toHaveLength(24)
    expect(doc.querySelectorAll('[data-lens-price]')).toHaveLength(24)
    expect(doc.querySelectorAll('[data-lens-hide-original]')).toHaveLength(24)

    const first = findCards(doc)[0]
    expect(first?.querySelector('[data-lens-badge]')?.textContent).toBe('4.96 · above avg · 49')
    expect(first?.querySelector('[data-lens-badge]')?.getAttribute('data-tone')).toBe('green')
    expect(first?.querySelector('[data-lens-price]')?.textContent).toBe('RM 585/night all-in')

    augmentSearchPage(DEFAULT_FILTERS, doc)
    expect(doc.querySelectorAll('[data-lens-badge]')).toHaveLength(24)
    expect(doc.querySelectorAll('[data-lens-price]')).toHaveLength(24)
  })

  it('hides and restores cards according to filters', () => {
    const strict = augmentSearchPage({ ...DEFAULT_FILTERS, minRating: 4.9 }, doc)
    expect(strict.hidden).toBeGreaterThan(0)
    expect(strict.hidden + strict.shown).toBe(24)
    expect(doc.querySelectorAll('[data-lens-hidden]')).toHaveLength(strict.hidden)
    // Every hidden node is a grid cell: a direct child of a container holding several cards
    // (the fixture has more than one card section), and it wraps exactly one card.
    const hiddenEls = Array.from(doc.querySelectorAll<HTMLElement>('[data-lens-hidden]'))
    for (const el of hiddenEls) {
      expect(el.style.display).toBe('none')
      expect(el.querySelectorAll('[data-testid="card-container"]').length).toBe(1)
      expect(
        el.parentElement?.querySelectorAll('[data-testid="card-container"]').length,
      ).toBeGreaterThan(1)
    }

    const relaxed = augmentSearchPage(DEFAULT_FILTERS, doc)
    expect(relaxed.hidden).toBe(0)
    expect(doc.querySelectorAll('[data-lens-hidden]')).toHaveLength(0)
  })

  it('superhostOnly and maxNightly work on real data', () => {
    const sh = augmentSearchPage({ ...DEFAULT_FILTERS, superhostOnly: true }, doc)
    expect(sh.shown).toBeGreaterThan(0)
    expect(sh.hidden).toBeGreaterThan(0)
    const cheap = augmentSearchPage({ ...DEFAULT_FILTERS, maxNightly: 500 }, doc)
    expect(cheap.shown).toBeGreaterThan(0)
    expect(cheap.hidden).toBeGreaterThan(0)
  })

  it('teardown removes everything', () => {
    augmentSearchPage({ ...DEFAULT_FILTERS, minRating: 4.9 }, doc)
    teardownSearchPage(doc)
    expect(
      doc.querySelectorAll(
        '[data-lens-badge], [data-lens-price], [data-lens-hidden], [data-lens-hide-original]',
      ),
    ).toHaveLength(0)
    expect(
      Array.from(doc.querySelectorAll<HTMLElement>('[itemprop="itemListElement"]')).every(
        (e) => e.style.display === '',
      ),
    ).toBe(true)
  })
})
