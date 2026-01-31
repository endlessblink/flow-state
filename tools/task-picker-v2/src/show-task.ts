#!/usr/bin/env npx tsx

import { parseMasterPlan } from './parser.js';

const taskId = process.argv[2];

if (!taskId) {
  console.error('Usage: show-task.ts <TASK-ID>');
  process.exit(1);
}

const tasks = parseMasterPlan();
const task = tasks.find(t => t.id === taskId || t.id.endsWith(taskId));

if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

console.log(`## Selected Task: ${task.id}`);
console.log('');
console.log(`**Title:** ${task.title}`);
console.log(`**Status:** ${task.status.replace('_', ' ')}`);
console.log(`**Priority:** ${task.priority || 'Not set'}`);
console.log(`**Type:** ${task.type}`);
console.log('');
console.log('### Description');
console.log(task.description || 'No description available.');
console.log('');
console.log('---');
console.log(`*Use /start-dev ${task.id} to begin working on this task.*`);
