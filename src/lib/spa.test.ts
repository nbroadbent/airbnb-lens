import { describe, expect, it } from 'vitest'
import { isLensMutation } from './spa'

function record(target: Node, added: Node[] = [], removed: Node[] = []): MutationRecord {
  return {
    type: 'childList',
    target,
    addedNodes: added as unknown as NodeList,
    removedNodes: removed as unknown as NodeList,
  } as unknown as MutationRecord
}

describe('isLensMutation', () => {
  it('flags mutations inside Lens-owned nodes', () => {
    const badge = document.createElement('span')
    badge.setAttribute('data-lens', '1')
    document.body.append(badge)
    const text = document.createTextNode('x')
    badge.append(text)
    expect(isLensMutation(record(badge, [text]))).toBe(true)
    expect(isLensMutation(record(text))).toBe(true)
  })
  it('flags insertion/removal of Lens nodes into the page', () => {
    const host = document.createElement('div')
    const pill = document.createElement('div')
    pill.setAttribute('data-lens', '1')
    expect(isLensMutation(record(host, [pill]))).toBe(true)
    expect(isLensMutation(record(host, [], [pill]))).toBe(true)
  })
  it('does not flag ordinary page mutations', () => {
    const host = document.createElement('div')
    const card = document.createElement('div')
    expect(isLensMutation(record(host, [card]))).toBe(false)
    expect(isLensMutation(record(host))).toBe(false)
  })
})
