import { beforeEach, describe, expect, it } from 'vitest'
import { removeStatusPill, renderStatusPill } from './hello'

describe('renderStatusPill', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('injects a tagged pill into the body', () => {
    const pill = renderStatusPill('search')
    expect(document.body.contains(pill)).toBe(true)
    expect(pill.getAttribute('data-lens')).toBe('1')
    expect(pill.textContent).toContain('Airbnb Lens active')
    expect(pill.textContent).toContain('search results')
  })

  it('is idempotent across re-runs', () => {
    renderStatusPill('search')
    renderStatusPill('search')
    renderStatusPill('listing')
    const pills = document.querySelectorAll('[data-lens].lens-pill')
    expect(pills).toHaveLength(1)
    expect(pills[0]?.textContent).toContain('listing page')
  })

  it('can be removed', () => {
    renderStatusPill('search')
    removeStatusPill()
    expect(document.querySelector('.lens-pill')).toBeNull()
  })
})
