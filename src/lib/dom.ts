/** Idempotency helpers. Every element Lens injects is tagged `data-lens="1"`. */

export const LENS_ATTR = 'data-lens'

export function markLens<T extends Element>(el: T): T {
  el.setAttribute(LENS_ATTR, '1')
  return el
}

export function isLens(el: Element): boolean {
  return el.getAttribute(LENS_ATTR) === '1'
}

/** Mark a host element as already processed for a given feature so re-runs skip it. */
export function markProcessed(el: Element, feature: string): void {
  el.setAttribute(`data-lens-${feature}`, '1')
}

export function isProcessed(el: Element, feature: string): boolean {
  return el.hasAttribute(`data-lens-${feature}`)
}

/** Build a tagged element in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (text !== undefined) node.textContent = text
  return markLens(node)
}
