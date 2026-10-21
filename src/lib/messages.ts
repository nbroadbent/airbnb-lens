/** Messages between the popup and the content script. Kept tiny and versioned by shape. */
import type { PageKind } from './page'

export interface PingRequest {
  type: 'lens:ping'
}

export interface PingResponse {
  type: 'lens:pong'
  version: string
  page: PageKind
  enabled: boolean
  url: string
}

export interface DiagnosticsRequest {
  type: 'lens:diagnostics'
}

export interface CardDiagnostic {
  id: string | null
  source: 'json' | 'dom' | 'unresolved'
  title: string | null
  priceRowText: string | null
  rating: number | null
  reviews: number | null
  total: string | null
  nights: number | null
  perNight: number | null
  nightlyBase: string | null
  /** Raw structuredDisplayPrice from the embedded JSON (loggingMetadata stripped), if the card was in it. */
  jsonPrice: unknown
}

export interface DiagnosticsResponse {
  type: 'lens:diagnostics-result'
  version: string
  url: string
  page: PageKind
  settings: unknown
  lastResult: unknown
  nightsHint: number | undefined
  embeddedStateScripts: number
  indexSize: number
  /** Up to 6 cards, unpriced/unresolved ones first. */
  cards: CardDiagnostic[]
}

export type LensMessage = PingRequest | DiagnosticsRequest

function hasType(msg: unknown, type: string): boolean {
  return typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === type
}

export function isPingRequest(msg: unknown): msg is PingRequest {
  return hasType(msg, 'lens:ping')
}

export function isDiagnosticsRequest(msg: unknown): msg is DiagnosticsRequest {
  return hasType(msg, 'lens:diagnostics')
}
