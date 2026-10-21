import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Parse a saved Airbnb page into a detached Document (scripts never execute). */
export type FixtureName =
  | 'search.html'
  | 'search-ssr.html'
  | 'search-ssr-nodates-usd.html'
  | 'search-cad-regulated.html'
  | 'search-cad-monthly.html'

/** URL each fixture was captured from (so location-derived hints, e.g. nights, work in tests). */
export const FIXTURE_URLS: Record<FixtureName, string> = {
  'search.html':
    'https://www.airbnb.com/s/Honolulu--HI--United-States/homes?checkin=2026-12-01&checkout=2026-12-05&adults=2',
  'search-ssr.html':
    'https://www.airbnb.com/s/Honolulu--HI--United-States/homes?checkin=2026-12-01&checkout=2026-12-05&adults=2',
  'search-ssr-nodates-usd.html':
    'https://www.airbnb.com/s/Honolulu--HI--United-States/homes?adults=2&currency=USD',
  'search-cad-regulated.html':
    'https://www.airbnb.com/s/Honolulu--HI--United-States/homes?checkin=2026-12-01&checkout=2026-12-05&adults=2',
  'search-cad-monthly.html':
    'https://www.airbnb.ca/s/Honolulu--HI--United-States/homes?checkin=2026-12-01&checkout=2027-01-01&adults=2',
}

export function loadFixture(name: FixtureName): Document {
  const html = readFileSync(resolve(process.cwd(), 'fixtures', name), 'utf8')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // DOMParser documents have about:blank as location; give them the capture URL via <base>.
  const base = doc.createElement('base')
  base.href = FIXTURE_URLS[name]
  doc.head.prepend(base)
  return doc
}
