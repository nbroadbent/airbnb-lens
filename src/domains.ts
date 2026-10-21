/**
 * Every Airbnb host the extension runs on.
 *
 * Chrome match patterns do NOT allow a wildcard in the TLD (`*://*.airbnb.*\/*` is
 * rejected by Chrome), so the country domains have to be enumerated. This is the
 * single source of truth: manifest.config.ts derives `content_scripts[].matches`
 * from it, and isAirbnbHost() uses it at runtime.
 *
 * To add a domain: append it here and rebuild. Nothing else needs to change.
 *
 * Verified against Airbnb's country/region picker: 2026-10-21
 */
export const AIRBNB_DOMAINS: readonly string[] = [
  'airbnb.com',
  'airbnb.ae',
  'airbnb.am',
  'airbnb.at',
  'airbnb.az',
  'airbnb.ba',
  'airbnb.be',
  'airbnb.bg',
  'airbnb.by',
  'airbnb.ca',
  'airbnb.cat',
  'airbnb.ch',
  'airbnb.cl',
  'airbnb.cn',
  'airbnb.co.cr',
  'airbnb.co.id',
  'airbnb.co.il',
  'airbnb.co.in',
  'airbnb.co.kr',
  'airbnb.co.nz',
  'airbnb.co.uk',
  'airbnb.co.ve',
  'airbnb.co.za',
  'airbnb.com.ar',
  'airbnb.com.au',
  'airbnb.com.bo',
  'airbnb.com.br',
  'airbnb.com.bz',
  'airbnb.com.co',
  'airbnb.com.ec',
  'airbnb.com.gt',
  'airbnb.com.hk',
  'airbnb.com.hn',
  'airbnb.com.mt',
  'airbnb.com.my',
  'airbnb.com.ni',
  'airbnb.com.pa',
  'airbnb.com.pe',
  'airbnb.com.py',
  'airbnb.com.sg',
  'airbnb.com.sv',
  'airbnb.com.tr',
  'airbnb.com.tw',
  'airbnb.cz',
  'airbnb.de',
  'airbnb.dk',
  'airbnb.ee',
  'airbnb.es',
  'airbnb.fi',
  'airbnb.fr',
  'airbnb.gr',
  'airbnb.gy',
  'airbnb.hr',
  'airbnb.hu',
  'airbnb.ie',
  'airbnb.is',
  'airbnb.it',
  'airbnb.jp',
  'airbnb.lt',
  'airbnb.lu',
  'airbnb.lv',
  'airbnb.me',
  'airbnb.mx',
  'airbnb.nl',
  'airbnb.no',
  'airbnb.pl',
  'airbnb.pt',
  'airbnb.ro',
  'airbnb.rs',
  'airbnb.ru',
  'airbnb.se',
  'airbnb.si',
  'airbnb.sk',
  'airbnb.vn',
]

/** Match patterns for manifest `content_scripts[].matches`. */
export const AIRBNB_MATCH_PATTERNS: readonly string[] = AIRBNB_DOMAINS.map((d) => `*://*.${d}/*`)

/** True when `hostname` is an Airbnb domain or a subdomain of one. */
export function isAirbnbHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return AIRBNB_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`))
}
