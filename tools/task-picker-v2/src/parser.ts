import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Task, TaskType, Status, Priority } from './types.js';

const TASK_HEADER_PATTERN = /^###\s+(~~)?((TASK|BUG|FEATURE|ROAD|IDEA|ISSUE|INQUIRY)-\d+)(~~)?:\s*(.+?)\s*\(([^)]+)\)/;
const PRIORITY_PATTERN = /\*\*Priority\*\*:\s*(P[0-3]|Critical|High|Medium|Low)/i;

function normalizeStatus(raw: string, hasStrikethrough: boolean): Status {
  if (hasStrikethrough) return 'DONE';

  const upper = raw.toUpperCase().trim();

  if (upper.includes('DONE') || upper.includes('COMPLETE') || upper.includes('FIXED') || upper.includes('✅')) {
    return 'DONE';
  }
  if (upper.includes('IN PROGRESS') || upper.includes('IN-PROGRESS') || upper.includes('🔄')) {
    return 'IN_PROGRESS';
  }
  if (upper.includes('REVIEW') || upper.includes('👀') || upper.includes('MONITORING')) {
    return 'REVIEW';
  }
  if (upper.includes('PAUSED') || upper.includes('⏸️') || upper.includes('ON HOLD')) {
    return 'PAUSED';
  }

  return 'PLANNED';
}

function normalizePriority(raw: string): Priority | undefined {
  const upper = raw.toUpperCase();
  if (upper.includes('P0') || upper.includes('CRITICAL')) return 'P0';
  if (upper.includes('P1') || upper.includes('HIGH')) return 'P1';
  if (upper.includes('P2') || upper.includes('MEDIUM')) return 'P2';
  if (upper.includes('P3') || upper.includes('LOW')) return 'P3';
  return undefined;
}

export function parseMasterPlan(filePath?: string): Task[] {
  const masterPlanPath = filePath || resolve(process.cwd(), 'docs/MASTER_PLAN.md');

  let content: string;
  try {
    content = readFileSync(masterPlanPath, 'utf-8');
  } catch (error) {
    console.error(`Failed to read MASTER_PLAN.md at ${masterPlanPath}`);
    return [];
  }

  const lines = content.split('\n');
  const tasks: Task[] = [];

  let currentTask: Task | null = null;
  let descriptionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(TASK_HEADER_PATTERN);

    if (match) {
      // Save previous task with its description
      if (currentTask) {
        currentTask.description = descriptionLines.join('\n').trim();
        tasks.push(currentTask);
      }

      const [, openStrike, id, type, closeStrike, title, statusRaw] = match;
      const hasStrikethrough = !!(openStrike && closeStrike);

      currentTask = {
        id,
        type: type as TaskType,
        title: title.trim(),
        status: normalizeStatus(statusRaw, hasStrikethrough),
        isDone: hasStrikethrough || normalizeStatus(statusRaw, false) === 'DONE',
        lineNumber: i + 1,
      };

      descriptionLines = [];
    } else if (currentTask) {
      // Check for priority in following lines
      const priorityMatch = line.match(PRIORITY_PATTERN);
      if (priorityMatch && !currentTask.priority) {
        currentTask.priority = normalizePriority(priorityMatch[1]);
      }

      // Stop collecting description at next section
      if (line.startsWith('### ') || line.startsWith('## ')) {
        currentTask.description = descriptionLines.join('\n').trim();
        tasks.push(currentTask);
        currentTask = null;
        descriptionLines = [];
      } else {
        descriptionLines.push(line);
      }
    }
  }

  // Don't forget the last task
  if (currentTask) {
    currentTask.description = descriptionLines.join('\n').trim();
    tasks.push(currentTask);
  }

  return tasks;
}

export function filterTasks(tasks: Task[], options: import('./types.js').FilterOptions): Task[] {
  return tasks.filter(task => {
    if (options.excludeDone && task.isDone) return false;
    if (options.status?.length && !options.status.includes(task.status)) return false;
    if (options.type?.length && !options.type.includes(task.type)) return false;
    if (options.priority?.length && task.priority && !options.priority.includes(task.priority)) return false;
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      const inTitle = task.title.toLowerCase().includes(searchLower);
      const inId = task.id.toLowerCase().includes(searchLower);
      const inDesc = task.description?.toLowerCase().includes(searchLower);
      if (!inTitle && !inId && !inDesc) return false;
    }
    return true;
  });
}
