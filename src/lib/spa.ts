import { LENS_ATTR } from './dom'
import { log } from './log'

export interface SpaWatcher {
  stop: () => void
}

/** True when a mutation record only concerns nodes Lens owns. */
export function isLensMutation(r: MutationRecord): boolean {
  const target = r.target instanceof Element ? r.target : r.target.parentElement
  if (target?.closest(`[${LENS_ATTR}="1"]`)) return true
  const nodes = [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)]
  return (
    nodes.length > 0 &&
    nodes.every((n) => n instanceof Element && n.getAttribute(LENS_ATTR) === '1')
  )
}

/**
 * Re-run `onChange` whenever Airbnb re-renders or navigates.
 *
 * Why not patch history.pushState? Content scripts live in an isolated world; the
 * page's own `history` wrapper is a different object, so a patch here never sees
 * Airbnb's calls. Instead we observe document.body (debounced) and compare
 * location.href on every tick. Any SPA navigation re-renders the DOM, so URL
 * changes are caught within one debounce window. `popstate` covers back/forward.
 */
export function watchSpa(onChange: (reason: string) => void, debounceMs = 250): SpaWatcher {
  let lastHref = location.href
  let timer: ReturnType<typeof setTimeout> | undefined

  const fire = (reason: string): void => {
    if (location.href !== lastHref) {
      lastHref = location.href
      reason = `navigation (${reason})`
    }
    try {
      onChange(reason)
    } catch (err) {
      log.error('onChange handler threw:', err)
    }
  }

  const schedule = (reason: string): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fire(reason)
    }, debounceMs)
  }

  // Ignore mutations Lens itself makes (badges, prices, panel). Without this, every
  // augmentation pass re-triggers the observer and the page is re-augmented forever.
  const observer = new MutationObserver((records) => {
    if (records.every((r) => isLensMutation(r))) return
    schedule('mutation')
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const onPop = (): void => {
    schedule('popstate')
  }
  window.addEventListener('popstate', onPop)

  return {
    stop: () => {
      observer.disconnect()
      window.removeEventListener('popstate', onPop)
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
