import { describe, expect, it } from 'vitest'
import { calibrateRating, parseRatingText } from './rating'

describe('calibrateRating', () => {
  it('buckets per spec', () => {
    expect(calibrateRating(5.0, 50).tier).toBe('above')
    expect(calibrateRating(4.9, 50).tier).toBe('above')
    expect(calibrateRating(4.96, 50).color).toBe('green')
    expect(calibrateRating(4.8, 50).tier).toBe('average')
    expect(calibrateRating(4.84, 50).tier).toBe('average')
    expect(calibrateRating(4.85, 50).tier).toBe('average')
    expect(calibrateRating(4.7, 50).tier).toBe('below')
    expect(calibrateRating(4.6, 50).tier).toBe('below')
    expect(calibrateRating(4.56, 50).tier).toBe('well-below')
    expect(calibrateRating(4.5, 50).tier).toBe('well-below')
    expect(calibrateRating(3.0, 50).color).toBe('red')
  })
  it('flags new and low-confidence', () => {
    expect(calibrateRating(null, null)).toMatchObject({
      tier: 'new',
      color: 'blue',
      lowConfidence: true,
    })
    expect(calibrateRating(5.0, 7).lowConfidence).toBe(true)
    expect(calibrateRating(5.0, 10).lowConfidence).toBe(false)
    expect(calibrateRating(4.9, null).lowConfidence).toBe(false)
  })
})

describe('parseRatingText', () => {
  it('parses Airbnb formats', () => {
    expect(parseRatingText('4.96 (49)')).toEqual({ rating: 4.96, reviews: 49 })
    expect(parseRatingText('5.0 (7)')).toEqual({ rating: 5, reviews: 7 })
    expect(parseRatingText('4.8 (1,187)')).toEqual({ rating: 4.8, reviews: 1187 })
    expect(parseRatingText('4,96 (49)')).toEqual({ rating: 4.96, reviews: 49 })
    expect(parseRatingText('4.96 out of 5 average rating,  49 reviews')).toEqual({
      rating: 4.96,
      reviews: 49,
    })
  })
  it('returns nulls for unrated', () => {
    expect(parseRatingText('New')).toEqual({ rating: null, reviews: null })
    expect(parseRatingText(null)).toEqual({ rating: null, reviews: null })
    expect(parseRatingText('')).toEqual({ rating: null, reviews: null })
  })
})
