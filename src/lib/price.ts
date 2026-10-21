/** Money and nights arithmetic. Pure functions, no DOM. */

export interface Money {
  amount: number
  /** Marker printed next to the number: "$", "RM", "€", "CA$"... */
  currency: string
  /** Trailing code when both a symbol and a code are shown ("$926 CAD" → "CAD"). */
  suffix?: string
}

const NBSP = /[\u00a0\u202f\s]+/g

/**
 * Parse a localized price string such as "$1,234", "RM 2,340", "€1.234,56",
 * "1 234 €", "₹12,345.50". Returns undefined if no digits are present.
 *
 * Decimal rule: if the LAST separator is followed by exactly 1–2 digits and there
 * is either a different separator earlier or only one separator total with 1–2
 * digits after it, it is a decimal point. Otherwise every separator is a
 * thousands separator. Airbnb's totals are whole numbers in practice.
 */
export function parseMoney(text: string | null | undefined): Money | undefined {
  if (!text) return undefined
  const cleaned = text.replace(NBSP, ' ').trim()
  const m = /(-?)([\d][\d.,' ]*\d|\d)/.exec(cleaned)
  if (!m) return undefined
  const numeric = m[2] ?? ''
  const sign = m[1] === '-' ? -1 : 1
  const prefix = cleaned
    .slice(0, m.index)
    .replace(/[\d\s-]/g, '')
    .trim()
  const after = cleaned
    .slice(m.index + m[0].length)
    .replace(/[\d\s]/g, '')
    .trim()
  // "$926 CAD" → currency "$", suffix "CAD". "1 234 €" → currency "€". "RM 2,340" → "RM".
  const currency = prefix || after
  const suffix = prefix && after ? after : ''

  const seps = numeric.match(/[.,' ]/g) ?? []
  let amount: number
  if (seps.length === 0) {
    amount = Number(numeric)
  } else {
    const lastSep = numeric.lastIndexOf(seps[seps.length - 1] ?? '')
    const tail = numeric.slice(lastSep + 1)
    const distinct = new Set(seps)
    const lastIsDecimal =
      tail.length >= 1 &&
      tail.length <= 2 &&
      (distinct.size > 1 || seps.length === 1) &&
      !(seps.length === 1 && tail.length === 3)
    if (lastIsDecimal) {
      const intPart = numeric.slice(0, lastSep).replace(/[.,' ]/g, '')
      amount = Number(`${intPart}.${tail}`)
    } else {
      amount = Number(numeric.replace(/[.,' ]/g, ''))
    }
  }
  if (!Number.isFinite(amount)) return undefined
  return suffix ? { amount: sign * amount, currency, suffix } : { amount: sign * amount, currency }
}

/** "for 4 nights" → 4; "for 1 night" → 1; anything else → undefined. */
export function nightsFromQualifier(text: string | null | undefined): number | undefined {
  if (!text) return undefined
  const m = /(\d+)\s*night/i.exec(text)
  if (!m) return undefined
  const n = Number(m[1])
  return n > 0 ? n : undefined
}

/** Nights between checkin/checkout URL params (YYYY-MM-DD). Undefined if absent/invalid. */
export function nightsFromUrl(url: string | URL): number | undefined {
  let u: URL
  try {
    u = typeof url === 'string' ? new URL(url) : url
  } catch {
    return undefined
  }
  const ci = u.searchParams.get('checkin') ?? u.searchParams.get('check_in')
  const co = u.searchParams.get('checkout') ?? u.searchParams.get('check_out')
  if (!ci || !co) return undefined
  const a = Date.parse(`${ci}T00:00:00Z`)
  const b = Date.parse(`${co}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined
  const nights = Math.round((b - a) / 86_400_000)
  return nights > 0 ? nights : undefined
}

/** total ÷ nights, rounded to whole units. Undefined unless both are sane. */
export function perNight(total: number, nights: number | undefined): number | undefined {
  if (!Number.isFinite(total) || nights === undefined || nights <= 0) return undefined
  return Math.round(total / nights)
}

/** Format an amount with its currency marker, no decimals: "$585", "CA$585", "RM 585", "$232 CAD". */
export function formatMoney(amount: number, currency: string, suffix?: string): string {
  const n = Math.round(amount).toLocaleString('en-US')
  const tail = suffix ? ` ${suffix}` : ''
  if (!currency) return `${n}${tail}`
  // Markers ending in a symbol hug the number ("$585", "CA$585"); letter codes get a space ("RM 585").
  return (/[^\w\s]$/.test(currency) ? `${currency}${n}` : `${currency} ${n}`) + tail
}

/** "4 nights x $201.51 CAD" → 4. Used on price-breakdown lines. */
export function nightsFromBreakdown(text: string | null | undefined): number | undefined {
  if (!text) return undefined
  const m = /^(\d+)\s*nights?\s*[x×]/i.exec(text.trim())
  const n = m ? Number(m[1]) : NaN
  return n > 0 ? n : undefined
}
