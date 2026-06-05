/**
 * TASK-1814 — regression lock for the grouped-cards block parsing + stripping.
 * These guard the two bugs the user hit: (1) raw {"groups":…} JSON leaking into the
 * chat text, (2) cards mapping to the wrong tasks. If either regresses, this fails.
 */
import { describe, it, expect } from 'vitest'
import { parseCardGroups, stripCardsBlock } from '@/services/ai/pipeline/cardsBlock'

const tasks = [
  { id: 't1', title: 'Check payment via Cardcom', priority: 'high', daysOverdue: 4 },
  { id: 't2', title: 'Build outreach list', priority: 'high', daysOverdue: 2 },
  { id: 't3', title: 'Write cold opener', priority: 'high', daysOverdue: 2 },
]
const results = [{ success: true, message: 'overdue', data: tasks }]

const block = (obj: object) => '```cards\n' + JSON.stringify(obj) + '\n```'

describe('parseCardGroups — maps [N] index → the RIGHT task', () => {
  it('maps each item index to the correct task (1-based)', () => {
    const text = 'Money first, then the sales chain.\n\n' + block({
      groups: [
        { name: 'Money', items: [{ i: 1, reason: 'revenue at risk' }] },
        { name: 'Sales (in order)', items: [{ i: 2, reason: 'blocks the opener' }, { i: 3, reason: 'needs the list' }] },
      ],
    })
    const r = parseCardGroups(text, results)
    expect(r).not.toBeNull()
    expect(r!.groups[0].tasks[0].title).toBe('Check payment via Cardcom')
    expect(r!.groups[0].tasks[0].reason).toBe('revenue at risk')
    expect(r!.groups[1].tasks.map(t => t.title)).toEqual(['Build outreach list', 'Write cold opener'])
    expect(r!.total).toBe(3)
  })

  it('drops items whose index has no matching task (never shows a phantom card)', () => {
    const text = block({ groups: [{ name: 'X', items: [{ i: 1, reason: 'ok' }, { i: 99, reason: 'nope' }] }] })
    const r = parseCardGroups(text, results)
    expect(r!.groups[0].tasks).toHaveLength(1)
    expect(r!.groups[0].tasks[0].title).toBe('Check payment via Cardcom')
  })

  it('returns null when there is no cards block, or it is malformed, or empty', () => {
    expect(parseCardGroups('just prose, no block', results)).toBeNull()
    expect(parseCardGroups('```cards\n{broken json\n```', results)).toBeNull()
    expect(parseCardGroups(block({ groups: [] }), results)).toBeNull()
    expect(parseCardGroups(block({ groups: [{ name: 'X', items: [] }] }), results)).toBeNull()
  })

  it('returns null when there are no tasks to map onto', () => {
    expect(parseCardGroups(block({ groups: [{ name: 'X', items: [{ i: 1, reason: 'r' }] }] }), [{ success: true, message: '', data: [] }])).toBeNull()
  })
})

describe('stripCardsBlock — NO raw JSON or [N] markers leak into the prose', () => {
  it('strips a normal fenced cards block', () => {
    const text = 'Here is the plan.\n\n' + block({ groups: [{ name: 'A', items: [{ i: 1, reason: 'r' }] }] })
    const out = stripCardsBlock(text)
    expect(out).toBe('Here is the plan.')
    expect(out).not.toContain('groups')
    expect(out).not.toContain('```')
  })

  it('strips a DE-FENCED bare {"groups":…} block (the exact leak from the screenshot)', () => {
    // cleanResponse() can drop the ``` fence, leaving bare JSON — must still be removed.
    const text = 'שלוש מגמות בולטות: ...\n\n{"groups":[{"name":"נזק חברתי","items":[{"i":16,"reason":"האירוע כבר עבר"}]}]}'
    const out = stripCardsBlock(text)
    expect(out).toBe('שלוש מגמות בולטות: ...')
    expect(out).not.toContain('"groups"')
    expect(out).not.toContain('"i":16')
  })

  it('strips leaked [N] / [2→3] / [2,3] task-index markers from prose', () => {
    expect(stripCardsBlock('do the payment [1] then the list [2→3] and [4, 5]')).toBe('do the payment then the list and')
  })

  it('leaves prose with no block untouched', () => {
    expect(stripCardsBlock('just a normal answer.')).toBe('just a normal answer.')
  })
})
