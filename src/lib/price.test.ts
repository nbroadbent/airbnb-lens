import { describe, expect, it } from 'vitest'
import { formatMoney, nightsFromQualifier, nightsFromUrl, parseMoney, perNight } from './price'

describe('parseMoney', () => {
  it('parses common formats', () => {
    expect(parseMoney('$1,234')).toEqual({ amount: 1234, currency: '$' })
    expect(parseMoney('RM 2,340')).toEqual({ amount: 2340, currency: 'RM' })
    expect(parseMoney('€1.234,56')).toEqual({ amount: 1234.56, currency: '€' })
    expect(parseMoney('1 234 €')).toEqual({ amount: 1234, currency: '€' })
    expect(parseMoney('₹12,345.50')).toEqual({ amount: 12345.5, currency: '₹' })
    expect(parseMoney('CA$585')).toEqual({ amount: 585, currency: 'CA$' })
    expect(parseMoney('$585')).toEqual({ amount: 585, currency: '$' })
    expect(parseMoney('$2,340.07')).toEqual({ amount: 2340.07, currency: '$' })
  })
  it('treats a lone separator with three digits as thousands', () => {
    expect(parseMoney('1.234')?.amount).toBe(1234)
    expect(parseMoney('1,234')?.amount).toBe(1234)
  })
  it('returns undefined without digits', () => {
    expect(parseMoney('')).toBeUndefined()
    expect(parseMoney('Show price breakdown')).toBeUndefined()
    expect(parseMoney(null)).toBeUndefined()
  })
})

describe('nights', () => {
  it('reads the qualifier', () => {
    expect(nightsFromQualifier('for 4 nights')).toBe(4)
    expect(nightsFromQualifier('for 1 night')).toBe(1)
    expect(nightsFromQualifier('RM 2,340 for 4 nights')).toBe(4)
    expect(nightsFromQualifier('night')).toBeUndefined()
    expect(nightsFromQualifier(null)).toBeUndefined()
  })
  it('reads checkin/checkout from the URL', () => {
    expect(
      nightsFromUrl('https://www.airbnb.com/s/x/homes?checkin=2026-12-01&checkout=2026-12-05'),
    ).toBe(4)
    expect(
      nightsFromUrl('https://www.airbnb.com/rooms/1?check_in=2026-12-01&check_out=2026-12-02'),
    ).toBe(1)
    expect(nightsFromUrl('https://www.airbnb.com/s/x/homes')).toBeUndefined()
    expect(
      nightsFromUrl('https://www.airbnb.com/s/x/homes?checkin=2026-12-05&checkout=2026-12-01'),
    ).toBeUndefined()
  })
})

describe('perNight / formatMoney', () => {
  it('divides and rounds', () => {
    expect(perNight(2340, 4)).toBe(585)
    expect(perNight(2339.07, 4)).toBe(585)
    expect(perNight(100, 0)).toBeUndefined()
    expect(perNight(100, undefined)).toBeUndefined()
  })
  it('formats symbol vs code', () => {
    expect(formatMoney(585, '$')).toBe('$585')
    expect(formatMoney(585, 'RM')).toBe('RM 585')
    expect(formatMoney(1234, 'CA$')).toBe('CA$1,234')
    expect(formatMoney(1234, '€')).toBe('€1,234')
    expect(formatMoney(585, '')).toBe('585')
  })
})
