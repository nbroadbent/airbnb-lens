import { isAirbnbHost } from '../domains'

export type PageKind = 'search' | 'listing' | 'other'

/**
 * Classify an Airbnb URL by path. Path shapes (verified 2026-10-21):
 *   search:  /s/<place>/homes, /s/homes, /s/<place>/experiences ...
 *   listing: /rooms/<id>, /rooms/plus/<id>, /luxury/listing/<id>
 * Anything else (home, trips, inbox, host tools) is 'other' and left untouched.
 */
export function classifyPage(url: string | URL): PageKind {
  let u: URL
  try {
    u = typeof url === 'string' ? new URL(url) : url
  } catch {
    return 'other'
  }
  if (!isAirbnbHost(u.hostname)) return 'other'

  const path = u.pathname.replace(/\/+$/, '')
  if (/^(\/[a-z]{2}(-[a-z]{2})?)?\/s(\/|$)/i.test(path)) return 'search'
  if (/^(\/[a-z]{2}(-[a-z]{2})?)?\/rooms\/(plus\/)?\d+/i.test(path)) return 'listing'
  if (/^(\/[a-z]{2}(-[a-z]{2})?)?\/luxury\/listing\/\d+/i.test(path)) return 'listing'
  return 'other'
}
