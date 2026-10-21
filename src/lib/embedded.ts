/**
 * Embedded-JSON access. Airbnb server-renders its Apollo/"niobe" state into
 * `<script id="data-deferred-state-0">` (verified 2026-10-21 on a search page).
 * The structure under it is deep and changes, so nothing here hard-codes a path:
 * callers walk the parsed tree and pick objects by their own keys.
 */
import { log } from './log'
import { qAll } from '../selectors'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Parse a script's text as JSON, tolerating an HTML-comment wrapper. Returns undefined on failure. */
export function parseEmbeddedJson(text: string | null | undefined): unknown {
  if (!text) return undefined
  let t = text.trim()
  if (t.startsWith('<!--') && t.endsWith('-->')) t = t.slice(4, -3).trim()
  try {
    return JSON.parse(t) as unknown
  } catch {
    return undefined
  }
}

/** All parsed embedded-state blobs on the page, in document order. */
export function readEmbeddedState(root: ParentNode = document): unknown[] {
  const out: unknown[] = []
  for (const script of qAll<HTMLScriptElement>('deferredStateScript', root)) {
    const parsed = parseEmbeddedJson(script.textContent)
    if (parsed === undefined) log.warn('embedded state script did not parse:', script.id)
    else out.push(parsed)
  }
  return out
}

/**
 * Depth-first walk collecting every object for which `match` returns true. Does not
 * descend into matched objects (a listing never contains another listing). Bounded
 * by `maxDepth` to be safe against pathological input.
 */
export function findObjects(
  root: unknown,
  match: (o: Record<string, unknown>) => boolean,
  maxDepth = 64,
): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const visit = (node: unknown, depth: number): void => {
    if (depth > maxDepth) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (!isObject(node)) return
    if (match(node)) {
      found.push(node)
      return
    }
    for (const v of Object.values(node)) visit(v, depth + 1)
  }
  visit(root, 0)
  return found
}
