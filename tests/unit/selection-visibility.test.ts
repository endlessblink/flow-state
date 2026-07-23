import { describe, expect, it } from 'vitest'
import { collectVisibleTaskIds, retainVisibleSelection } from '@/utils/selectionVisibility'

describe('visible task selection safety', () => {
  it('drops selected tasks that disappeared behind a filter', () => {
    expect(retainVisibleSelection(
      ['visible-a', 'hidden-b', 'visible-c'],
      ['visible-a', 'visible-c']
    )).toEqual(['visible-a', 'visible-c'])
  })

  it('preserves order while removing duplicates and unknown ids', () => {
    expect(retainVisibleSelection(
      ['visible-b', 'visible-a', 'visible-b', 'missing'],
      ['visible-a', 'visible-b']
    )).toEqual(['visible-b', 'visible-a'])
  })

  it('includes descendants only while every rendered parent is expanded', () => {
    const tasks = [
      { id: 'parent' },
      { id: 'child', parentId: 'parent' },
      { id: 'grandchild', parentId: 'child' },
    ]

    expect(collectVisibleTaskIds(tasks, ['parent'], new Set(['parent']))).toEqual([
      'parent',
      'child',
    ])
    expect(collectVisibleTaskIds(tasks, ['parent'], new Set(['parent', 'child']))).toEqual([
      'parent',
      'child',
      'grandchild',
    ])
  })
})
