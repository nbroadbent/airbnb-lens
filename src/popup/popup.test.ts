import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * popup.ts looks up every control by id at load time and throws if one is
 * missing, which takes the whole popup down. Keep the HTML and the script in sync.
 */
describe('popup markup matches popup.ts', () => {
  const html = readFileSync(resolve(process.cwd(), 'src/popup/index.html'), 'utf8')
  const ts = readFileSync(resolve(process.cwd(), 'src/popup/popup.ts'), 'utf8')
  const doc = new DOMParser().parseFromString(html, 'text/html')

  it('has every id the script queries', () => {
    const ids = [...ts.matchAll(/\$<[^>]+>\('([^']+)'\)/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(5)
    const missing = ids.filter((id) => !doc.getElementById(id ?? ''))
    expect(missing).toEqual([])
  })

  it('offers both price bases', () => {
    const values = Array.from(doc.querySelectorAll<HTMLOptionElement>('#priceBasis option')).map(
      (o) => o.value,
    )
    expect(values).toEqual(['nightly', 'total'])
  })
})
