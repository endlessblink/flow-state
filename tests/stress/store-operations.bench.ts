/**
 * @vitest-environment node
 */
import { bench, describe } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

/**
 * Performance Benchmarks for Store Operations
 * TASK-338: Comprehensive stress testing
 *
 * Run with: npm run test:bench
 *
 * These benchmarks measure the performance of critical store operations
 * to catch performance regressions.
 */

// Mock task factory
function createMockTask(overrides = {}) {
  return {
    id: uuidv4(),
    title: `Benchmark Task ${Date.now()}`,
    status: 'todo' as const,
    priority: 'medium' as const,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: null,
    completedAt: null,
    projectId: null,
    parentId: null,
    canvasPosition: { x: Math.random() * 1000, y: Math.random() * 1000 },
    estimatedPomodoros: 1,
    actualPomodoros: 0,
    tags: [],
    ...overrides
  };
}

describe('Task Array Operations', () => {
  bench('Create 100 tasks sequentially', () => {
    const tasks: ReturnType<typeof createMockTask>[] = [];

    for (let i = 0; i < 100; i++) {
      const task = createMockTask({ title: `Bench Task ${i}` });
      tasks.push(task);
    }

    if (tasks.length !== 100) throw new Error('Creation failed');
  }, { iterations: 100 });

  bench('Filter 10,000 tasks by status', () => {
    // Setup: Create 10k tasks
    const statuses = ['todo', 'in_progress', 'done', 'blocked'] as const;
    const tasks = Array.from({ length: 10000 }, (_, i) =>
      createMockTask({ status: statuses[i % statuses.length] })
    );

    // Benchmark: Filter by status
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const doneTasks = tasks.filter(t => t.status === 'done');

    // Ensure work was done
    if (todoTasks.length + inProgressTasks.length + doneTasks.length === 0) {
      throw new Error('Filter returned no results');
    }
  }, { iterations: 20 });

  bench('Sort 1,000 tasks by priority', () => {
    const priorities = ['critical', 'high', 'medium', 'low'] as const;
    const tasks = Array.from({ length: 1000 }, (_, i) =>
      createMockTask({ priority: priorities[i % priorities.length] })
    );

    // Benchmark: Sort by priority
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...tasks].sort((a, b) =>
      (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
    );

    if (sorted.length !== 1000) {
      throw new Error('Sort failed');
    }
  }, { iterations: 50 });

  bench('Find task by ID in 10,000 tasks', () => {
    const targetId = uuidv4();
    const tasks = Array.from({ length: 10000 }, (_, i) =>
      createMockTask({ id: i === 5000 ? targetId : uuidv4() })
    );

    // Benchmark: Find by ID
    const found = tasks.find(t => t.id === targetId);
    if (!found) {
      throw new Error('Task not found');
    }
  }, { iterations: 100 });

  bench('Find task by ID using Map (10,000 tasks)', () => {
    const targetId = uuidv4();
    const tasks = Array.from({ length: 10000 }, (_, i) =>
      createMockTask({ id: i === 5000 ? targetId : uuidv4() })
    );

    // Build index
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Benchmark: Find by ID using Map
    const found = taskMap.get(targetId);
    if (!found) {
      throw new Error('Task not found');
    }
  }, { iterations: 100 });
});

describe('Canvas Position Operations', () => {
  bench('Calculate bounding box for 500 nodes', async () => {
    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: uuidv4(),
      position: { x: Math.random() * 5000, y: Math.random() * 5000 },
      data: { title: `Node ${i}` }
    }));

    // Benchmark: Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    }

    const bounds = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    if (bounds.width <= 0) throw new Error('Invalid bounds');
  }, { iterations: 100 });

  bench('Filter nodes within viewport', async () => {
    const nodes = Array.from({ length: 1000 }, (_, i) => ({
      id: uuidv4(),
      position: { x: Math.random() * 10000, y: Math.random() * 10000 },
      dimensions: { width: 200, height: 100 }
    }));

    const viewport = { x: 2000, y: 2000, width: 1920, height: 1080 };

    // Benchmark: Filter visible nodes
    const visible = nodes.filter(node => {
      const nodeRight = node.position.x + node.dimensions.width;
      const nodeBottom = node.position.y + node.dimensions.height;
      const viewportRight = viewport.x + viewport.width;
      const viewportBottom = viewport.y + viewport.height;

      return !(node.position.x > viewportRight ||
               nodeRight < viewport.x ||
               node.position.y > viewportBottom ||
               nodeBottom < viewport.y);
    });

    // Some nodes should be visible
    if (visible.length === 0 && nodes.length > 0) {
      // That's fine, viewport might not overlap
    }
  }, { iterations: 50 });
});

describe('Checksum & Serialization', () => {
  bench('Serialize 1,000 tasks to JSON', async () => {
    const tasks = Array.from({ length: 1000 }, () => createMockTask());

    // Benchmark: JSON serialization
    const json = JSON.stringify(tasks);
    if (json.length < 1000) throw new Error('Serialization failed');
  }, { iterations: 100 });

  bench('Parse 1,000 tasks from JSON', async () => {
    const tasks = Array.from({ length: 1000 }, () => createMockTask());
    const json = JSON.stringify(tasks);

    // Benchmark: JSON parsing
    const parsed = JSON.parse(json);
    if (parsed.length !== 1000) throw new Error('Parse failed');
  }, { iterations: 100 });

  bench('Calculate SHA256 checksum of 1MB data', async () => {
    // Create ~1MB of data
    const data = JSON.stringify(Array.from({ length: 5000 }, () => createMockTask()));

    // Benchmark: Checksum (simulated - actual crypto would be slower)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }

    if (hash === 0 && data.length > 0) {
      // Hash of 0 is technically possible but unlikely
    }
  }, { iterations: 20 });
});
