import { describe, expect, it } from 'vitest'
import { classifyPage } from './page'

describe('classifyPage', () => {
  it('detects search result pages', () => {
    expect(classifyPage('https://www.airbnb.com/s/Honolulu--HI/homes?adults=2')).toBe('search')
    expect(classifyPage('https://www.airbnb.ca/s/homes')).toBe('search')
    expect(classifyPage('https://www.airbnb.co.uk/s/London/homes')).toBe('search')
    expect(classifyPage('https://www.airbnb.com/fr/s/Paris/homes')).toBe('search')
  })

  it('detects listing pages', () => {
    expect(classifyPage('https://www.airbnb.com/rooms/12345678?check_in=2026-11-01')).toBe(
      'listing',
    )
    expect(classifyPage('https://www.airbnb.com/rooms/plus/987654')).toBe('listing')
    expect(classifyPage('https://www.airbnb.com/luxury/listing/42')).toBe('listing')
    expect(classifyPage('https://www.airbnb.com.au/rooms/1')).toBe('listing')
  })

  it('leaves everything else alone', () => {
    expect(classifyPage('https://www.airbnb.com/')).toBe('other')
    expect(classifyPage('https://www.airbnb.com/trips/v1')).toBe('other')
    expect(classifyPage('https://www.airbnb.com/hosting')).toBe('other')
    expect(classifyPage('https://www.airbnb.com/rooms')).toBe('other')
    expect(classifyPage('https://example.com/s/homes')).toBe('other')
    expect(classifyPage('not a url')).toBe('other')
  })
})
