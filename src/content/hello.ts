import { el } from '../lib/dom'
import { log } from '../lib/log'
import type { PageKind } from '../lib/page'
import { q, qAll } from '../selectors'

const PILL_ID = 'lens-status-pill'

/**
 * Step-1 "hello world": a fixed pill in the bottom-right corner proving the content
 * script is running on this page. Idempotent: re-running updates the existing pill
 * instead of adding another. Will be replaced by the filter panel in the MVP.
 */
export function renderStatusPill(kind: PageKind, root: ParentNode = document): HTMLElement {
  let pill = root.querySelector<HTMLElement>(`#${PILL_ID}`)
  if (!pill) {
    pill = el('div', { id: PILL_ID, class: 'lens-pill', role: 'status' })
    pill.append(el('span', { class: 'lens-dot', 'aria-hidden': 'true' }))
    pill.append(el('span', { class: 'lens-label' }))
    pill.append(el('span', { class: 'lens-muted' }))
    const host = q<HTMLElement>('mountRoot', root) ?? document.body
    host.append(pill)
  }
  const label = pill.querySelector('.lens-label')
  const muted = pill.querySelector('.lens-muted')
  if (label) label.textContent = 'Airbnb Lens active'
  if (muted) muted.textContent = kind === 'search' ? '· search results' : `· ${kind} page`
  return pill
}

export function removeStatusPill(root: ParentNode = document): void {
  root.querySelector(`#${PILL_ID}`)?.remove()
}

/**
 * Diagnostics for step 2. Logs whether the data sources the spec expects actually
 * exist on this page, so we know what the fixtures will contain.
 */
export function logPageDiagnostics(root: ParentNode = document): void {
  const deferred = qAll<HTMLScriptElement>('deferredStateScript', root)
  const ldJson = qAll<HTMLScriptElement>('ldJsonScript', root)
  const testIds = new Set(
    Array.from(root.querySelectorAll('[data-testid]')).map(
      (n) => n.getAttribute('data-testid') ?? '',
    ),
  )
  log.info('diagnostics', {
    url: location.href,
    deferredStateScripts: deferred.length,
    deferredStateBytes: deferred.reduce((n, s) => n + (s.textContent?.length ?? 0), 0),
    ldJsonScripts: ldJson.length,
    distinctTestIds: testIds.size,
  })
}
