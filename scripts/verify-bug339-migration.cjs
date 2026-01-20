#!/usr/bin/env node
/**
 * BUG-339 Migration Verification Script
 *
 * Run this BEFORE testing to verify the migration logic is correct.
 * This is a DRY RUN - it won't modify any data.
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('BUG-339 Migration Logic Verification');
console.log('='.repeat(60));
console.log('');

// Simulate the fingerprint comparison logic
function generateFingerprint(title, dueDate, status) {
  return `${(title || '').toLowerCase().trim()}|${dueDate || ''}|${status}`;
}

// Test cases
const testCases = [
  {
    name: 'Exact match (should dedupe)',
    guestTask: { title: 'Buy groceries', dueDate: '2024-01-15', status: 'planned' },
    dbTask: { title: 'Buy groceries', due_date: '2024-01-15', status: 'planned' },
    expectDupe: true
  },
  {
    name: 'Case difference (should dedupe)',
    guestTask: { title: 'BUY GROCERIES', dueDate: '2024-01-15', status: 'planned' },
    dbTask: { title: 'buy groceries', due_date: '2024-01-15', status: 'planned' },
    expectDupe: true
  },
  {
    name: 'Whitespace difference (should dedupe)',
    guestTask: { title: '  Buy groceries  ', dueDate: '2024-01-15', status: 'planned' },
    dbTask: { title: 'Buy groceries', due_date: '2024-01-15', status: 'planned' },
    expectDupe: true
  },
  {
    name: 'Different title (should NOT dedupe)',
    guestTask: { title: 'Buy vegetables', dueDate: '2024-01-15', status: 'planned' },
    dbTask: { title: 'Buy groceries', due_date: '2024-01-15', status: 'planned' },
    expectDupe: false
  },
  {
    name: 'Different status (should NOT dedupe)',
    guestTask: { title: 'Buy groceries', dueDate: '2024-01-15', status: 'done' },
    dbTask: { title: 'Buy groceries', due_date: '2024-01-15', status: 'planned' },
    expectDupe: false
  },
  {
    name: 'Null due dates (should dedupe)',
    guestTask: { title: 'Buy groceries', dueDate: null, status: 'planned' },
    dbTask: { title: 'Buy groceries', due_date: null, status: 'planned' },
    expectDupe: true
  },
  {
    name: 'Empty string vs null due date (should dedupe)',
    guestTask: { title: 'Buy groceries', dueDate: '', status: 'planned' },
    dbTask: { title: 'Buy groceries', due_date: null, status: 'planned' },
    expectDupe: true
  }
];

console.log('Running deduplication logic tests...\n');

let passed = 0;
let failed = 0;

testCases.forEach((tc, i) => {
  const guestFp = generateFingerprint(tc.guestTask.title, tc.guestTask.dueDate, tc.guestTask.status);
  const dbFp = generateFingerprint(tc.dbTask.title, tc.dbTask.due_date, tc.dbTask.status);
  const isDupe = guestFp === dbFp;

  const status = isDupe === tc.expectDupe ? 'PASS' : 'FAIL';
  const icon = status === 'PASS' ? '✅' : '❌';

  console.log(`${icon} Test ${i + 1}: ${tc.name}`);
  console.log(`   Guest FP: "${guestFp}"`);
  console.log(`   DB FP:    "${dbFp}"`);
  console.log(`   Match: ${isDupe} (expected: ${tc.expectDupe})`);
  console.log('');

  if (status === 'PASS') passed++;
  else failed++;
});

console.log('='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED - DO NOT PROCEED WITH TESTING');
  process.exit(1);
} else {
  console.log('\n✅ VERIFICATION PASSED - Safe to proceed with manual testing');
  console.log('\nRecommended test steps:');
  console.log('1. Back up your database first: npm run backup:create');
  console.log('2. Sign out of the app');
  console.log('3. Create 2-3 test tasks while signed out');
  console.log('4. Sign in with your account');
  console.log('5. Verify: tasks migrated, no duplicates');
  console.log('6. Sign out and sign in again');
  console.log('7. Verify: no new duplicates created');
  process.exit(0);
}
