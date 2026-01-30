#!/usr/bin/env npx tsx
import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { TextInput, Select } from '@inkjs/ui';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MASTER_PLAN_PATH = path.resolve(__dirname, '../../docs/MASTER_PLAN.md');

// Types
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  isDone: boolean;
  type: string;
}

interface StatusConfig {
  emoji: string;
  color: string;
}

// Parse MASTER_PLAN.md to extract tasks
function parseMasterPlan(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split('\n');

  // Match task headers like: ### TASK-123: Title (STATUS)
  const taskPattern = /^###\s+(~~)?((TASK|BUG|INQUIRY|FEATURE|ROAD|IDEA|ISSUE)-\d+)(~~)?:\s*(.+?)\s*\(([^)]+)\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(taskPattern);

    if (match) {
      const [, strikeStart, id, prefix, strikeEnd, title, status] = match;
      const isDone = !!(strikeStart && strikeEnd);

      // Extract priority from the next few lines if present
      let priority = 'P2';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const priorityMatch = lines[j].match(/\*\*Priority\*\*:\s*(P[0-3])/i);
        if (priorityMatch) {
          priority = priorityMatch[1];
          break;
        }
      }

      tasks.push({
        id,
        title: title.trim(),
        status: status.trim(),
        priority,
        isDone,
        type: prefix
      });
    }
  }

  return tasks;
}

// Status emoji/color mapping
const STATUS_CONFIG: Record<string, StatusConfig> = {
  'IN PROGRESS': { emoji: '🔄', color: 'yellow' },
  'IN_PROGRESS': { emoji: '🔄', color: 'yellow' },
  'DONE': { emoji: '✅', color: 'green' },
  'COMPLETE': { emoji: '✅', color: 'green' },
  'PLANNED': { emoji: '📋', color: 'blue' },
  'REVIEW': { emoji: '👀', color: 'magenta' },
  'MONITORING': { emoji: '👀', color: 'magenta' },
  'PAUSED': { emoji: '⏸️', color: 'gray' },
};

function getStatusConfig(status: string): StatusConfig {
  const normalized = status.toUpperCase().replace(/[🔄✅📋👀⏸️\s]/g, '').trim();
  for (const [key, config] of Object.entries(STATUS_CONFIG)) {
    if (normalized.includes(key.replace(/[_\s]/g, ''))) {
      return config;
    }
  }
  return { emoji: '❓', color: 'white' };
}

// Non-interactive mode - just list tasks
function listTasks(showDone: boolean = false, filterType?: string) {
  const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf-8');
  const tasks = parseMasterPlan(content);

  const filtered = tasks.filter(task => {
    if (!showDone && task.isDone) return false;
    if (filterType && task.type !== filterType) return false;
    return true;
  });

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    FlowState Task Picker                           │');
  console.log('└─────────────────────────────────────────────────────────────────────┘\n');

  if (filtered.length === 0) {
    console.log('No tasks found.\n');
    return;
  }

  // Group by status
  const byStatus: Record<string, Task[]> = {};
  for (const task of filtered) {
    const statusConfig = getStatusConfig(task.status);
    const key = `${statusConfig.emoji} ${task.status}`;
    if (!byStatus[key]) byStatus[key] = [];
    byStatus[key].push(task);
  }

  for (const [status, statusTasks] of Object.entries(byStatus)) {
    console.log(`\n${status}:`);
    console.log('─'.repeat(50));
    for (const task of statusTasks) {
      const priority = task.priority.padEnd(2);
      const id = task.id.padEnd(12);
      const title = task.title.length > 45 ? task.title.substring(0, 42) + '...' : task.title;
      console.log(`  [${priority}] ${id} ${title}`);
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────────────────`);
  console.log(`Total: ${filtered.length} tasks (${tasks.filter(t => t.isDone).length} done, ${tasks.filter(t => !t.isDone).length} open)`);
  console.log('');
}

// Interactive picker component
function TaskPicker() {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tasks on mount
  useEffect(() => {
    try {
      const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf-8');
      const parsed = parseMasterPlan(content);
      setTasks(parsed);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to read MASTER_PLAN.md: ${err.message}`);
      setLoading(false);
    }
  }, []);

  // Filter tasks based on search and show/hide done
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filter out done tasks unless showDone is true
      if (!showDone && task.isDone) return false;

      // Search filter
      if (filter) {
        const searchLower = filter.toLowerCase();
        return (
          task.id.toLowerCase().includes(searchLower) ||
          task.title.toLowerCase().includes(searchLower) ||
          task.type.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [tasks, filter, showDone]);

  // Convert to select options
  const options = useMemo(() => {
    return filteredTasks.map(task => {
      const statusConfig = getStatusConfig(task.status);
      return {
        label: `${statusConfig.emoji} ${task.id}: ${task.title.substring(0, 50)}${task.title.length > 50 ? '...' : ''} [${task.priority}]`,
        value: task.id
      };
    });
  }, [filteredTasks]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
    if (input === 'd') {
      setShowDone(prev => !prev);
    }
  });

  // Handle selection
  const handleSelect = (value: string) => {
    // Output to stdout for piping
    console.log(`\n\nSelected: ${value}`);

    // Exit after a short delay to show selection
    setTimeout(() => exit(), 100);
  };

  if (loading) {
    return (
      <Box>
        <Text color="cyan">Loading tasks from MASTER_PLAN.md...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">FlowState Task Picker</Text>
        <Text color="gray"> | </Text>
        <Text color="gray">{filteredTasks.length}/{tasks.length} tasks</Text>
        <Text color="gray"> | </Text>
        <Text color="gray">Press </Text>
        <Text color="yellow">d</Text>
        <Text color="gray"> to {showDone ? 'hide' : 'show'} done | </Text>
        <Text color="yellow">ESC</Text>
        <Text color="gray"> to quit</Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="green">🔍 Filter: </Text>
        <TextInput
          placeholder="Type to filter tasks..."
          value={filter}
          onChange={setFilter}
        />
      </Box>

      {/* Task list */}
      {options.length > 0 ? (
        <Box flexDirection="column">
          <Text color="gray" dimColor>Use ↑↓ or j/k to navigate, Enter to select</Text>
          <Box marginTop={1}>
            <Select
              options={options}
              onChange={handleSelect}
              visibleOptionCount={15}
            />
          </Box>
        </Box>
      ) : (
        <Box>
          <Text color="yellow">No tasks match your filter.</Text>
        </Box>
      )}

      {/* Legend */}
      <Box marginTop={1} flexDirection="row" gap={2}>
        <Text color="gray" dimColor>
          🔄 In Progress | ✅ Done | 📋 Planned | 👀 Review | ⏸️ Paused
        </Text>
      </Box>
    </Box>
  );
}

// CLI argument parsing
const args = process.argv.slice(2);
const isListMode = args.includes('--list') || args.includes('-l');
const showDoneArg = args.includes('--done') || args.includes('-d');
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1];
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log(`
FlowState Task Picker
=====================

Usage:
  npx tsx index.tsx           # Interactive mode (requires TTY)
  npx tsx index.tsx --list    # Non-interactive list mode
  npx tsx index.tsx -l -d     # List including done tasks
  npx tsx index.tsx --type=BUG  # Filter by type (TASK, BUG, INQUIRY, etc.)

Options:
  -l, --list     List tasks non-interactively
  -d, --done     Include done/completed tasks
  --type=TYPE    Filter by task type (TASK, BUG, INQUIRY, FEATURE, ROAD)
  -h, --help     Show this help

Interactive Mode Controls:
  ↑/↓ or j/k    Navigate tasks
  Enter         Select task
  d             Toggle show/hide done tasks
  Type          Filter tasks
  ESC           Exit
`);
  process.exit(0);
}

if (isListMode) {
  // Non-interactive mode
  listTasks(showDoneArg, typeFilter);
} else {
  // Check if we're in a TTY
  if (!process.stdin.isTTY) {
    console.log('Interactive mode requires a TTY. Use --list for non-interactive mode.');
    console.log('Run with --help for usage information.\n');
    listTasks(showDoneArg, typeFilter);
    process.exit(0);
  }

  // Interactive mode
  render(<TaskPicker />);
}
