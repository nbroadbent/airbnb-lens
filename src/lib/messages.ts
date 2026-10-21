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

export type LensMessage = PingRequest

export function isPingRequest(msg: unknown): msg is PingRequest {
  return typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === 'lens:ping'
}
