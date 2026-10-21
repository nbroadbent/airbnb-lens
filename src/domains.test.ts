import { describe, expect, it } from 'vitest'
import { AIRBNB_DOMAINS, AIRBNB_MATCH_PATTERNS, isAirbnbHost } from './domains'

describe('domains', () => {
  it('matches airbnb hosts and subdomains', () => {
    expect(isAirbnbHost('www.airbnb.com')).toBe(true)
    expect(isAirbnbHost('airbnb.com')).toBe(true)
    expect(isAirbnbHost('www.airbnb.co.uk')).toBe(true)
    expect(isAirbnbHost('fr.airbnb.ca')).toBe(true)
  })

  it('rejects look-alikes', () => {
    expect(isAirbnbHost('notairbnb.com')).toBe(false)
    expect(isAirbnbHost('airbnb.com.evil.example')).toBe(false)
    expect(isAirbnbHost('example.com')).toBe(false)
  })

  it('produces valid Chrome match patterns with no duplicates', () => {
    expect(new Set(AIRBNB_DOMAINS).size).toBe(AIRBNB_DOMAINS.length)
    for (const p of AIRBNB_MATCH_PATTERNS) {
      expect(p).toMatch(/^\*:\/\/\*\.airbnb\.[a-z.]+\/\*$/)
    }
  })
})
