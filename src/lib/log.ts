/** All console output goes through here so every line carries the `[Lens]` prefix. */
const PREFIX = '[Lens]'

export const log = {
  info: (...args: unknown[]): void => {
    console.info(PREFIX, ...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args)
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args)
  },
}

/**
 * Run `fn`, swallowing and logging any exception. One failing augmentation must
 * never take down the rest of the page. Returns undefined on failure.
 */
export function guarded<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn()
  } catch (err) {
    log.error(`${label} failed:`, err)
    return undefined
  }
}
