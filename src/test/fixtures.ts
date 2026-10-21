import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Parse a saved Airbnb page into a detached Document (scripts never execute). */
export function loadFixture(name: 'search.html' | 'search-ssr.html'): Document {
  const html = readFileSync(resolve(process.cwd(), 'fixtures', name), 'utf8')
  return new DOMParser().parseFromString(html, 'text/html')
}
