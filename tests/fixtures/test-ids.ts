/**
 * TASK-1457: Centralized test data IDs
 * These match the seed data created by tests/global-setup.ts
 * The test user is created dynamically — only data IDs are fixed.
 */

export const TEST_PROJECTS = {
  work: { id: '11111111-1111-1111-1111-111111111111', name: 'Work', color: '#4ECDC4' },
  personal: { id: '22222222-2222-2222-2222-222222222222', name: 'Personal', color: '#FF6B6B' },
} as const

export const TEST_TASKS = {
  designLandingPage: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', title: 'Design landing page', status: 'planned', priority: 'high' },
  setupCICD: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', title: 'Set up CI/CD pipeline', status: 'in_progress', priority: 'high' },
  writeUnitTests: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', title: 'Write unit tests', status: 'planned', priority: 'medium' },
  codeReview: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', title: 'Code review PR #42', status: 'done', priority: 'medium' },
  buyGroceries: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', title: 'Buy groceries', status: 'planned', priority: 'low' },
  morningWorkout: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa06', title: 'Morning workout routine', status: 'planned', priority: 'medium' },
  readChapter: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa07', title: 'Read chapter 5', status: 'done', priority: 'low' },
  planTrip: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa08', title: 'Plan weekend trip', status: 'planned', priority: 'high' },
} as const

export const TEST_GROUPS = {
  todo: { id: 'group-todo-test', name: 'To Do' },
  done: { id: 'group-done-test', name: 'Completed' },
} as const
