#!/usr/bin/env npx tsx

import { parseMasterPlan, filterTasks } from './parser.js';
import type { Status, FilterOptions } from './types.js';

const args = process.argv.slice(2);
const options: FilterOptions = { excludeDone: true };
let limit = 15;  // Default higher to show PLANNED tasks
let outputFormat: 'json' | 'simple' = 'simple';

for (const arg of args) {
  if (arg === '--json') outputFormat = 'json';
  if (arg === '--all') options.excludeDone = false;
  if (arg === '--bugs') options.type = ['BUG'];
  if (arg === '--progress') options.status = ['IN_PROGRESS'];
  if (arg === '--planned') options.status = ['PLANNED'];
  if (arg === '--review') options.status = ['REVIEW'];
  if (arg === '--active') options.status = ['IN_PROGRESS', 'REVIEW'];  // Active work only
  if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1], 10);
}

const tasks = parseMasterPlan();
const filtered = filterTasks(tasks, options);

// PLANNED first (what to start next), then REVIEW, then active work
const statusOrder: Record<Status, number> = {
  'PLANNED': 0,
  'REVIEW': 1,
  'IN_PROGRESS': 2,
  'PAUSED': 3,
  'DONE': 4,
};

const priorityOrder: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };

filtered.sort((a, b) => {
  const statusDiff = statusOrder[a.status] - statusOrder[b.status];
  if (statusDiff !== 0) return statusDiff;
  const aPri = a.priority ? priorityOrder[a.priority] : 99;
  const bPri = b.priority ? priorityOrder[b.priority] : 99;
  return aPri - bPri;
});

const top = filtered.slice(0, limit);

if (outputFormat === 'json') {
  console.log(JSON.stringify(top.map(t => ({
    id: t.id,
    title: t.title.slice(0, 50) + (t.title.length > 50 ? '...' : ''),
    status: t.status,
    priority: t.priority || 'P2',
  }))));
} else {
  for (const task of top) {
    const pri = task.priority || 'P2';
    console.log(`${task.status.padEnd(12)} [${pri}] ${task.id}: ${task.title.slice(0, 50)}`);
  }
}
