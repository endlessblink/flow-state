#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { parseMasterPlan, filterTasks } from './parser.js';
import type { Task, Status, TaskType, FilterOptions } from './types.js';

// Status emoji mapping
const STATUS_EMOJI: Record<Status, string> = {
  'IN_PROGRESS': '🔄',
  'PLANNED': '📋',
  'DONE': '✅',
  'PAUSED': '⏸️',
  'REVIEW': '👀',
};

// Priority colors
const PRIORITY_COLOR: Record<string, (s: string) => string> = {
  'P0': pc.red,
  'P1': pc.yellow,
  'P2': pc.blue,
  'P3': pc.dim,
};

function formatTaskLabel(task: Task): string {
  const priority = task.priority ? PRIORITY_COLOR[task.priority]?.(` [${task.priority}]`) || ` [${task.priority}]` : '';
  const status = STATUS_EMOJI[task.status] || '';
  const id = task.isDone ? pc.strikethrough(pc.dim(task.id)) : pc.cyan(task.id);
  const title = task.isDone ? pc.dim(task.title) : task.title;

  return `${status} ${id}${priority}: ${title}`.trim();
}

function formatTaskHint(task: Task): string {
  const desc = task.description?.split('\n')[0]?.slice(0, 60) || '';
  return desc ? `${desc}${desc.length >= 60 ? '...' : ''}` : task.status;
}

function formatTaskOutput(task: Task): string {
  return `
## Selected Task: ${task.id}

**Title:** ${task.title}
**Status:** ${task.status.replace('_', ' ')}
**Priority:** ${task.priority || 'Not set'}
**Type:** ${task.type}

### Description
${task.description || 'No description available.'}

---
*Use /start-dev ${task.id} to begin working on this task.*
`.trim();
}

function sortTasks(tasks: Task[]): Task[] {
  const statusOrder: Record<Status, number> = {
    'IN_PROGRESS': 0,
    'REVIEW': 1,
    'PLANNED': 2,
    'PAUSED': 3,
    'DONE': 4,
  };

  const priorityOrder: Record<string, number> = {
    'P0': 0,
    'P1': 1,
    'P2': 2,
    'P3': 3,
  };

  return [...tasks].sort((a, b) => {
    // First by status
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by priority (P0 first)
    const aPriority = a.priority ? priorityOrder[a.priority] : 99;
    const bPriority = b.priority ? priorityOrder[b.priority] : 99;
    return aPriority - bPriority;
  });
}

interface ParsedArgs {
  options: FilterOptions;
  listMode: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const options: FilterOptions = { excludeDone: true };
  let listMode = false;

  for (const arg of args) {
    if (arg === '--list' || arg === '-l') {
      listMode = true;
    } else if (arg === '--all' || arg === '-a') {
      options.excludeDone = false;
    } else if (arg.startsWith('--status=')) {
      const statuses = arg.replace('--status=', '').toUpperCase().split(',');
      options.status = statuses.map(s => s.replace('-', '_')) as Status[];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.replace('--type=', '').toUpperCase().split(',') as TaskType[];
    } else if (arg.startsWith('--search=') || arg.startsWith('-s=')) {
      options.search = arg.split('=')[1];
    } else if (arg === '--bugs') {
      options.type = ['BUG'];
    } else if (arg === '--tasks') {
      options.type = ['TASK'];
    } else if (arg === '--progress') {
      options.status = ['IN_PROGRESS'];
    }
  }

  return { options, listMode };
}

function listTasks(tasks: Task[]): void {
  console.log(pc.bgCyan(pc.black(' Task Picker ')) + ` - ${tasks.length} tasks\n`);

  let currentStatus: Status | null = null;

  for (const task of tasks) {
    // Print status header when it changes
    if (task.status !== currentStatus) {
      currentStatus = task.status;
      console.log(pc.bold(`\n${STATUS_EMOJI[currentStatus]} ${currentStatus.replace('_', ' ')}`));
      console.log(pc.dim('─'.repeat(40)));
    }

    console.log(`  ${formatTaskLabel(task)}`);
  }
  console.log();
}

async function main() {
  const { options, listMode } = parseArgs();

  // Parse MASTER_PLAN.md
  const allTasks = parseMasterPlan();

  if (allTasks.length === 0) {
    console.error(pc.red('No tasks found in MASTER_PLAN.md'));
    process.exit(1);
  }

  // Filter and sort
  const tasks = sortTasks(filterTasks(allTasks, options));

  if (tasks.length === 0) {
    console.error(pc.red('No tasks match the filter criteria'));
    process.exit(1);
  }

  // List mode - just print and exit
  if (listMode) {
    listTasks(tasks);
    process.exit(0);
  }

  // Interactive mode
  p.intro(pc.bgCyan(pc.black(' Task Picker ')));
  p.log.info(`Found ${pc.bold(tasks.length.toString())} tasks`);

  // Group options by status for visual separation
  const taskOptions = tasks.map(task => ({
    value: task,
    label: formatTaskLabel(task),
    hint: formatTaskHint(task),
  }));

  const selected = await p.select({
    message: 'Select a task to work on',
    options: taskOptions,
    maxItems: 15,
  });

  if (p.isCancel(selected)) {
    p.cancel('No task selected');
    process.exit(0);
  }

  // Output the selected task
  console.log('\n' + formatTaskOutput(selected as Task));

  p.outro(pc.green(`Selected: ${(selected as Task).id}`));
}

main().catch(console.error);
