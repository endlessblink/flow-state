/**
 * TASK-1814 — regression lock for the grouped-cards block parsing + stripping.
 * These guard the two bugs the user hit: (1) raw {"groups":…} JSON leaking into the
 * chat text, (2) cards mapping to the wrong tasks. If either regresses, this fails.
 */
import { describe, it, expect } from 'vitest'
import { ensureCardTaskMentions, parseCardGroups, stripCardsBlock, stripStreamingCardsBlock } from '@/services/ai/pipeline/cardsBlock'

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

  it('preserves day-plan kind metadata for apply-order cards', () => {
    const text = 'Start with money, then unblock sales.\n\n' + block({
      kind: 'day_plan',
      groups: [
        { name: 'First focus block', items: [{ i: 1, reason: 'highest external stake' }] },
        { name: 'Second focus block', items: [{ i: 2, reason: 'sets up outreach' }] },
      ],
    })
    const r = parseCardGroups(text, results)
    expect(r?.kind).toBe('day_plan')
    expect(r?.groups.map(g => g.name)).toEqual(['First focus block', 'Second focus block'])
  })

  it('preserves smart-lanes metadata and new task suggestions', () => {
    const text = 'Make a sales lane.\n\n' + block({
      kind: 'smart_lanes',
      groups: [
        {
          name: 'Sales Push',
          items: [{ i: 2, reason: 'seed list first' }],
          newTasks: [
            { title: 'Draft follow-up sequence', priority: 'medium', reason: 'turns list into outreach' },
          ],
        },
      ],
    })
    const r = parseCardGroups(text, results)
    expect(r?.kind).toBe('smart_lanes')
    expect(r?.groups[0].tasks[0].title).toBe('Build outreach list')
    expect(r?.groups[0].newTasks).toEqual([
      { title: 'Draft follow-up sequence', priority: 'medium', reason: 'turns list into outreach' },
    ])
  })

  it('TASK-1820: maps weekly-review cards (completed tasks) and preserves kind', () => {
    // get_weekly_summary returns the ARRAY of completed-this-week tasks, so the
    // weekly review renders REAL clickable cards instead of fabricated names.
    const completed = [
      { id: 'c1', title: 'ניקיון כללי', priority: 'low', status: 'done' },
      { id: 'c2', title: 'Cloudflare Workers', priority: 'high', status: 'done' },
    ]
    const weeklyResults = [{ success: true, message: 'סיכום שבועי: הושלמו 2 משימות', data: completed }]
    const text = 'השלמת 2 משימות השבוע.\n\n' + block({
      kind: 'weekly_review',
      groups: [
        { name: 'בית', items: [{ i: 1, reason: 'תחזוקה שוטפת' }] },
        { name: 'פרויקטים', items: [{ i: 2, reason: 'פריסה לפרודקשן' }] },
      ],
    })
    const r = parseCardGroups(text, weeklyResults)
    expect(r?.kind).toBe('weekly_review')
    expect(r!.groups[0].tasks[0].title).toBe('ניקיון כללי')
    expect(r!.groups[1].tasks[0].title).toBe('Cloudflare Workers')
    expect(r!.total).toBe(2)
  })

  it('TASK-1821: preserves week_plan kind (forward planning cards)', () => {
    const upcoming = [
      { id: 'u1', title: 'Prep renewal email', priority: 'high', status: 'todo' },
      { id: 'u2', title: 'Call the dentist', priority: 'medium', status: 'todo' },
    ]
    const planResults = [{ success: true, message: 'upcoming', data: upcoming }]
    const text = 'Start with the renewal email.\n\n' + block({
      kind: 'week_plan',
      groups: [
        { name: 'ראשון', items: [{ i: 1, reason: 'deadline approaching' }] },
        { name: 'המשך השבוע', items: [{ i: 2, reason: 'quick win' }] },
      ],
    })
    const r = parseCardGroups(text, planResults)
    expect(r?.kind).toBe('week_plan')
    expect(r!.groups[0].tasks[0].title).toBe('Prep renewal email')
    expect(r!.groups[1].tasks[0].title).toBe('Call the dentist')
  })

  it('repairs shallow card reasons with task-derived stakes', () => {
    const text = 'Start with Check payment via Cardcom.\n\n' + block({
      kind: 'week_plan',
      groups: [
        { name: 'Money', items: [{ i: 1, reason: 'deadline 2026-06-07' }] },
        { name: 'Sales', items: [{ i: 2, reason: 'medium priority' }] },
      ],
    })
    const r = parseCardGroups(text, results)

    expect(r?.groups[0].tasks[0].reason).toBe('money or billing can get stuck if this slips')
    expect(r?.groups[1].tasks[0].reason).toBe('this belongs to one sales sequence worth batching')
  })

  it('keeps specific model reasons when they explain the real stake', () => {
    const text = 'Start with Check payment via Cardcom.\n\n' + block({
      kind: 'week_plan',
      groups: [
        { name: 'Money', items: [{ i: 1, reason: 'prevents a stuck customer charge before follow-up' }] },
      ],
    })
    const r = parseCardGroups(text, results)

    expect(r?.groups[0].tasks[0].reason).toBe('prevents a stuck customer charge before follow-up')
  })

  it('maps cards onto nested directive task arrays in the same order the model saw', () => {
    const nestedResults = [{
      success: true,
      message: 'daily plan',
      data: {
        dueTodayTasks: [
          { id: 'today-1', title: 'Check Cardcom payment', priority: 'high', status: 'todo' },
        ],
        overdueTasks: [
          { id: 'late-1', title: 'Reply to Miri', priority: 'medium', status: 'todo' },
        ],
      },
    }]
    const text = 'First protect cash, then answer the stakeholder.\n\n' + block({
      kind: 'day_plan',
      groups: [
        { name: 'Money risk', items: [{ i: 1, reason: 'payment uncertainty blocks decisions' }] },
        { name: 'Stakeholder follow-up', items: [{ i: 2, reason: 'keeps a waiting person from drifting' }] },
      ],
    })
    const r = parseCardGroups(text, nestedResults)
    expect(r?.groups.map(g => g.tasks.map(t => t.title))).toEqual([
      ['Check Cardcom payment'],
      ['Reply to Miri'],
    ])
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

  it('strips a DE-FENCED bare {"kind":"smart_lanes","groups":…} block', () => {
    const text = 'Use these lanes.\n\n{"kind":"smart_lanes","groups":[{"name":"Sales","items":[{"i":2,"reason":"same push"}]}]}'
    const out = stripCardsBlock(text)
    expect(out).toBe('Use these lanes.')
    expect(out).not.toContain('"smart_lanes"')
    expect(out).not.toContain('"groups"')
  })

  it('strips leaked [N] / [2→3] / [2,3] task-index markers from prose', () => {
    expect(stripCardsBlock('do the payment [1] then the list [2→3] and [4, 5]')).toBe('do the payment then the list and')
  })

  it('leaves prose with no block untouched', () => {
    expect(stripCardsBlock('just a normal answer.')).toBe('just a normal answer.')
  })
})

describe('ensureCardTaskMentions — cards have a prose anchor for inline rendering', () => {
  it('adds a grounding line before the cards block when a selected task is missing from prose', () => {
    const text = 'Start with the payment work.\n\n' + block({
      kind: 'week_plan',
      groups: [
        { name: 'Money', items: [{ i: 1, reason: 'payment risk' }] },
        { name: 'Sales', items: [{ i: 3, reason: 'keeps outreach moving' }] },
      ],
    })
    const parsed = parseCardGroups(text, results)!
    const out = ensureCardTaskMentions(text, parsed, 'To keep each card tied to the recommendation:')

    expect(out).toContain('Start with the payment work.')
    expect(out).toContain('**Check payment via Cardcom**')
    expect(out).toContain('**Write cold opener**')
    expect(out.indexOf('**Write cold opener**')).toBeLessThan(out.indexOf('```cards'))
    expect(parseCardGroups(out, results)?.groups[1].tasks[0].title).toBe('Write cold opener')
  })

  it('leaves the response unchanged when every selected task is already named', () => {
    const text = 'Do Check payment via Cardcom, then Write cold opener.\n\n' + block({
      kind: 'week_plan',
      groups: [
        { name: 'Money', items: [{ i: 1, reason: 'payment risk' }] },
        { name: 'Sales', items: [{ i: 3, reason: 'keeps outreach moving' }] },
      ],
    })
    const parsed = parseCardGroups(text, results)!
    expect(ensureCardTaskMentions(text, parsed, 'Anchor:')).toBe(text)
  })

  it('uses normalized title matching before adding grounding lines', () => {
    const text = '**check   PAYMENT via cardcom** is the first money risk.\n\n' + block({
      kind: 'week_plan',
      groups: [
        { name: 'Money', items: [{ i: 1, reason: 'payment risk' }] },
      ],
    })
    const parsed = parseCardGroups(text, results)!

    expect(ensureCardTaskMentions(text, parsed, 'Anchor:')).toBe(text)
  })
})

describe('stripStreamingCardsBlock — hides card JSON while chunks are still arriving', () => {
  it.each([
    ['Here is the plan.\n\n`', 'Here is the plan.'],
    ['Here is the plan.\n\n```', 'Here is the plan.'],
    ['Here is the plan.\n\n```ca', 'Here is the plan.'],
    ['Here is the plan.\n\n```cards', 'Here is the plan.'],
    ['Here is the plan.\n\n```cards\n{"groups":[', 'Here is the plan.'],
  ])('strips partial stream content "%s"', (input, expected) => {
    expect(stripStreamingCardsBlock(input)).toBe(expected)
  })

  it('keeps normal prose while stripping completed card blocks', () => {
    const input = 'Do Cardcom first, then outreach.\n\n' + block({
      groups: [{ name: 'Money', items: [{ i: 1, reason: 'payment risk' }] }],
    })
    expect(stripStreamingCardsBlock(input)).toBe('Do Cardcom first, then outreach.')
  })
})
