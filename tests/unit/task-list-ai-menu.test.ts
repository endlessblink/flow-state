import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(__dirname, '../../src/components/tasks/TaskList.vue'), 'utf8')

describe('TaskList group AI menu', () => {
  it('opens a visible menu with date and all-details choices', () => {
    expect(source).toContain('group-ai-menu')
    expect(source).toContain('Suggest dates')
    expect(source).toContain('Suggest all details')
    expect(source).toContain('groupSuggestFocus')
    expect(source).toContain(':group-focus="groupSuggestFocus"')
  })
})
