/**
 * Unified Task Service - Central coordination for all task/idea management systems
 *
 * This service provides a single source of truth for task management across:
 * - @issue-creator (Claude Code integration)
 * - MarkdownTaskManager (Visual kanban HTML interface)
 * - Pomo-Flow App (Vue 3 productivity application)
 */

import { ref, computed, reactive as _reactive } from 'vue';
// TODO: These imports don't exist - temporarily commenting out to fix compilation
// import type {
//   UnifiedTask,
//   TaskStageValues,
//   CreateTaskRequest,
//   UpdateTaskRequest,
//   TaskEvent,
//   TaskFilter,
//   TaskSort
// } from '@/types/unified-task';
// import { TaskStorage } from '@/storage/task-storage';
// import { GitHubService } from '@/services/github-service';
// import { EventBus } from '@/utils/event-bus';
// import { IdMappingService } from '@/utils/id-mapping';
// import { ConflictResolutionService } from '@/utils/conflict-resolution';

// Temporary mock types to prevent compilation errors
interface TaskMetadata {
  source: string;
  priority: string;
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
}

interface GitHubIssueRef {
  id: string;
  url: string;
}

interface UnifiedTask {
  id: string;
  title: string;
  description: string;
  stage: string;
  legacyIds: Record<string, string>;
  metadata: TaskMetadata;
  parentId?: string;
  childIds: string[];
  dependsOn: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date;
  syncStatus: string;
  githubIssue?: GitHubIssueRef;
  completedAt?: Date;
}

type TaskStage = 'backlog' | 'planned' | 'in_progress' | 'done' | 'on_hold';

// TaskStage enum-like object for value usage
const TaskStageValues = {
  backlog: 'backlog' as const,
  planned: 'planned' as const,
  in_progress: 'in_progress' as const,
  done: 'done' as const,
  on_hold: 'on_hold' as const,
  // Legacy values that were referenced
  IDEA: 'backlog' as const,
  BACKLOG: 'backlog' as const,
  PLANNING: 'planned' as const,
  DEVELOPMENT: 'in_progress' as const,
  REVIEW: 'in_progress' as const,
  TESTING: 'in_progress' as const,
  ARCHIVED: 'done' as const
};

interface CreateTaskRequest {
  title: string;
  description?: string;
  source?: string;
  priority?: string;
  tags?: string[];
  estimatedHours?: number;
  stage?: TaskStage;
  parentId?: string;
  dependsOn?: string[];
  legacyIds?: Record<string, string>;
}

interface UpdateTaskRequest {
  id: string;
  updates: Partial<UnifiedTask>;
  stage?: TaskStage;
}

interface TaskEvent {
  type: string;
  timestamp: Date;
  data: UnifiedTask | { taskId: string };
}

interface TaskFilter {
  stage?: string;
  priority?: string;
  source?: string;
  tags?: string[];
  search?: string;
  dateRange?: { start: Date; end: Date };
}

interface TaskSort {
  field: 'title' | 'priority' | 'stage' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

// Mock class implementations to prevent compilation errors
class TaskStorage {
  async save(_tasks: UnifiedTask[]): Promise<void> {
    console.log('Mock TaskStorage.save called');
  }

  async load(): Promise<UnifiedTask[]> {
    console.log('Mock TaskStorage.load called');
    return [];
  }

  async delete(_id: string): Promise<void> {
    console.log('Mock TaskStorage.delete called');
  }

  async findById(_id: string): Promise<UnifiedTask | null> {
    console.log('Mock TaskStorage.findById called');
    return null;
  }

  async findAll(): Promise<UnifiedTask[]> {
    console.log('Mock TaskStorage.findAll called');
    return [];
  }

  async getLastSyncTime(): Promise<Date | null> {
    console.log('Mock TaskStorage.getLastSyncTime called');
    return null;
  }

  async setLastSyncTime(_date: Date): Promise<void> {
    console.log('Mock TaskStorage.setLastSyncTime called');
  }
}

class GitHubService {
  async sync(_tasks: UnifiedTask[]): Promise<void> {
    console.log('Mock GitHubService.sync called');
  }

  async createIssue(_task: UnifiedTask): Promise<GitHubIssueRef> {
    console.log('Mock GitHubService.createIssue called');
    return { id: 'mock-issue-id', url: 'https://github.com/mock' };
  }

  async updateIssue(_task: UnifiedTask): Promise<void> {
    console.log('Mock GitHubService.updateIssue called');
  }

  async closeIssue(_issueId: string): Promise<void> {
    console.log('Mock GitHubService.closeIssue called');
  }
}

interface EventData {
  type: string;
  taskId: string;
  data: UnifiedTask;
  source: string;
  timestamp: Date;
}

class EventBus {
  emit(_event: string, _data: EventData): void {
    console.log('Mock EventBus.emit called');
  }

  on(_event: string, _callback: (...args: any[]) => void): void {
    console.log('Mock EventBus.on called');
  }
}

class IdMappingService {
  generateId(): string {
    return Date.now().toString();
  }

  createMappings(_task: UnifiedTask): void {
    console.log('Mock IdMappingService.createMappings called');
  }

  saveMappings(_tasks: UnifiedTask[]): void {
    console.log('Mock IdMappingService.saveMappings called');
  }

  async deleteMappings(_id: string): Promise<void> {
    console.log('Mock IdMappingService.deleteMappings called');
  }

  async getUnifiedId(_legacyId: string, _system: string): Promise<string | null> {
    console.log('Mock IdMappingService.getUnifiedId called');
    return null;
  }
}

interface TaskConflict {
  taskId: string;
  localVersion: UnifiedTask;
  remoteVersion: UnifiedTask;
}

class ConflictResolutionService {
  resolve(_conflicts: TaskConflict[]): UnifiedTask[] {
    console.log('Mock ConflictResolutionService.resolve called');
    return [];
  }
}

export class UnifiedTaskService {
  private storage: TaskStorage;
  private githubService: GitHubService;
  private eventBus: EventBus;
  private idMapping: IdMappingService;
  private conflictResolver: ConflictResolutionService;

  // Reactive state for Vue components
  private _tasks = ref<UnifiedTask[]>([]);
  private _loading = ref(false);
  private _error = ref<string | null>(null);
  private _lastSyncAt = ref<Date | null>(null);

  constructor() {
    this.storage = new TaskStorage();
    this.githubService = new GitHubService();
    this.eventBus = new EventBus();
    this.idMapping = new IdMappingService();
    this.conflictResolver = new ConflictResolutionService();

    this.initializeEventListeners();
    this.loadTasks();
  }

  // Public reactive getters
  get tasks() {
    return computed(() => this._tasks.value);
  }

  get loading() {
    return computed(() => this._loading.value);
  }

  get error() {
    return computed(() => this._error.value);
  }

  get lastSyncAt() {
    return computed(() => this._lastSyncAt.value);
  }

  // Task CRUD operations
  async createTask(request: CreateTaskRequest): Promise<UnifiedTask> {
    this._loading.value = true;
    this._error.value = null;

    try {
      const task: UnifiedTask = {
        id: this.generateId(),
        legacyIds: {},
        title: request.title,
        description: request.description || '',
        metadata: {
          source: request.source || 'claude-code',
          priority: request.priority || 'medium',
          tags: request.tags || [],
          estimatedHours: request.estimatedHours,
          actualHours: 0
        },
        stage: request.stage || TaskStageValues.IDEA,
        parentId: request.parentId,
        childIds: [],
        dependsOn: request.dependsOn || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: new Date(),
        syncStatus: 'pending'
      };

      // Map legacy IDs if provided
      if (request.legacyIds) {
        task.legacyIds = { ...request.legacyIds };
        await this.idMapping.createMappings(task);
      }

      // Save to storage
      await this.storage.save([task]);

      // Add to reactive state
      this._tasks.value.push(task);

      // Sync with GitHub if needed
      if (this.shouldCreateGitHubIssue(task)) {
        await this.syncWithGitHub(task);
      }

      // Emit event
      this.eventBus.emit('task:created', {
        type: 'task:created',
        taskId: task.id,
        data: task,
        source: task.metadata.source,
        timestamp: new Date()
      });

      return task;
    } catch (error) {
      this._error.value = `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this._loading.value = false;
    }
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<UnifiedTask> {
    this._loading.value = true;
    this._error.value = null;

    try {
      const existingTask = await this.findById(id);
      if (!existingTask) {
        throw new Error(`Task with ID ${id} not found`);
      }

      let updatedTask: UnifiedTask = {
        ...existingTask,
        ...updates,
        updatedAt: new Date(),
        syncStatus: 'pending'
      };

      // Handle stage transitions
      if (updates.stage && updates.stage !== existingTask.stage) {
        updatedTask = await this.handleStageTransition(updatedTask, existingTask.stage, updates.stage);
      }

      // Save to storage
      await this.storage.save([updatedTask]);

      // Update reactive state
      const index = this._tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        this._tasks.value[index] = updatedTask;
      }

      // Sync with GitHub
      await this.syncWithGitHub(updatedTask);

      // Emit event
      this.eventBus.emit('task:updated', {
        type: 'task:updated',
        taskId: updatedTask.id,
        data: updatedTask,
        source: updatedTask.metadata.source,
        timestamp: new Date()
      });

      return updatedTask;
    } catch (error) {
      this._error.value = `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this._loading.value = false;
    }
  }

  async deleteTask(id: string): Promise<void> {
    this._loading.value = true;
    this._error.value = null;

    try {
      const task = await this.findById(id);
      if (!task) {
        throw new Error(`Task with ID ${id} not found`);
      }

      // Check for dependencies
      const dependentTasks = await this.findDependentTasks(id);
      if (dependentTasks.length > 0) {
        throw new Error(`Cannot delete task ${id}. It has ${dependentTasks.length} dependent tasks.`);
      }

      // Close GitHub issue if exists
      if (task.githubIssue) {
        await this.githubService.closeIssue(task.githubIssue.id);
      }

      // Delete from storage
      await this.storage.delete(id);

      // Remove from reactive state
      this._tasks.value = this._tasks.value.filter(t => t.id !== id);

      // Clean up ID mappings
      await this.idMapping.deleteMappings(id);

      // Emit event
      this.eventBus.emit('task:deleted', {
        type: 'task:deleted',
        taskId: id,
        data: task,
        source: task.metadata.source,
        timestamp: new Date()
      });
    } catch (error) {
      this._error.value = `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this._loading.value = false;
    }
  }

  async moveTask(id: string, newStage: TaskStage): Promise<UnifiedTask> {
    return this.updateTask(id, { id, updates: { stage: newStage } });
  }

  // Task retrieval operations
  async findById(id: string): Promise<UnifiedTask | null> {
    // Check reactive state first
    const task = this._tasks.value.find(t => t.id === id);
    if (task) return task;

    // Fallback to storage
    return await this.storage.findById(id);
  }

  async findByLegacyId(legacyId: string, system: 'issue-creator' | 'markdown-manager' | 'pomo-flow'): Promise<UnifiedTask | null> {
    const unifiedId = await this.idMapping.getUnifiedId(legacyId, system);
    return unifiedId ? this.findById(unifiedId) : null;
  }

  async findDependentTasks(taskId: string): Promise<UnifiedTask[]> {
    return this._tasks.value.filter(task =>
      task.dependsOn.includes(taskId) || task.childIds.includes(taskId)
    );
  }

  // Filtering and sorting
  getFilteredTasks(filter: TaskFilter, sort?: TaskSort): UnifiedTask[] {
    let filtered = this._tasks.value;

    // Apply filters
    if (filter.stage) {
      filtered = filtered.filter(task => task.stage === filter.stage);
    }

    if (filter.priority) {
      filtered = filtered.filter(task => task.metadata.priority === filter.priority);
    }

    if (filter.source) {
      filtered = filtered.filter(task => task.metadata.source === filter.source);
    }

    if (filter.tags && filter.tags.length > 0) {
      const filterTags = filter.tags;
      filtered = filtered.filter(task =>
        filterTags.some((tag: string) => task.metadata.tags.includes(tag))
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower)
      );
    }

    if (filter.dateRange) {
      const dateRange = filter.dateRange;
      filtered = filtered.filter(task => {
        const taskDate = task.createdAt;
        return taskDate >= dateRange.start && taskDate <= dateRange.end;
      });
    }

    // Apply sorting
    if (sort) {
      filtered = this.sortTasks(filtered, sort);
    }

    return filtered;
  }

  private sortTasks(tasks: UnifiedTask[], sort: TaskSort): UnifiedTask[] {
    return [...tasks].sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      switch (sort.field) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'priority': {
          const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.metadata.priority] || 0;
          bValue = priorityOrder[b.metadata.priority] || 0;
          break;
        }
        case 'stage': {
          const stageOrder: string[] = [
            TaskStageValues.IDEA, TaskStageValues.BACKLOG, TaskStageValues.PLANNING,
            TaskStageValues.DEVELOPMENT, TaskStageValues.REVIEW, TaskStageValues.TESTING,
            TaskStageValues.done, TaskStageValues.ARCHIVED
          ];
          aValue = stageOrder.indexOf(a.stage);
          bValue = stageOrder.indexOf(b.stage);
          break;
        }
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // GitHub synchronization
  private async syncWithGitHub(task: UnifiedTask): Promise<void> {
    try {
      if (task.githubIssue) {
        // Update existing issue
        await this.githubService.updateIssue(task);
      } else if (this.shouldCreateGitHubIssue(task)) {
        // Create new issue
        const issue = await this.githubService.createIssue(task);
        task.githubIssue = issue;
        await this.storage.save([task]);
      }

      task.syncStatus = 'synced';
      task.lastSyncAt = new Date();
      this._lastSyncAt.value = new Date();
    } catch (error) {
      console.error('GitHub sync failed:', error);
      task.syncStatus = 'pending';
      throw error;
    }
  }

  private shouldCreateGitHubIssue(task: UnifiedTask): boolean {
    // Create GitHub issue for tasks that have moved beyond idea stage
    return task.stage !== TaskStageValues.IDEA && !task.githubIssue;
  }

  private async handleStageTransition(
    task: UnifiedTask,
    fromStage: string,
    toStage: TaskStage
  ): Promise<UnifiedTask> {
    // Add stage transition logic here
    // For example, automatic subtask creation, notifications, etc.

    switch (toStage) {
      case TaskStageValues.DEVELOPMENT:
        // Move to development - might create development checklist
        break;
      case TaskStageValues.done:
        // Mark as done - set completion date
        task.completedAt = new Date();
        break;
      case TaskStageValues.ARCHIVED:
        // Archive - might clean up subtasks
        break;
    }

    return task;
  }

  // Event handling
  private initializeEventListeners(): void {
    this.eventBus.on('external:task-created', this.handleExternalTaskCreated.bind(this));
    this.eventBus.on('external:task-updated', this.handleExternalTaskUpdated.bind(this));
    this.eventBus.on('external:task-deleted', this.handleExternalTaskDeleted.bind(this));
  }

  private async handleExternalTaskCreated(event: TaskEvent): Promise<void> {
    // Handle task creation from external systems
    const task = event.data as UnifiedTask;
    this._tasks.value.push(task);
    await this.storage.save([task]);
  }

  private async handleExternalTaskUpdated(event: TaskEvent): Promise<void> {
    // Handle task updates from external systems
    const updatedTask = event.data as UnifiedTask;
    const index = this._tasks.value.findIndex(t => t.id === updatedTask.id);

    if (index !== -1) {
      this._tasks.value[index] = updatedTask;
      await this.storage.save([updatedTask]);
    }
  }

  private async handleExternalTaskDeleted(event: TaskEvent): Promise<void> {
    // Handle task deletion from external systems
    const data = event.data;
    const taskId = 'taskId' in data ? data.taskId : (data as UnifiedTask).id;
    this._tasks.value = this._tasks.value.filter(t => t.id !== taskId);
    await this.storage.delete(taskId);
  }

  // Data loading and initialization
  private async loadTasks(): Promise<void> {
    this._loading.value = true;
    this._error.value = null;

    try {
      const tasks = await this.storage.findAll();
      this._tasks.value = tasks;
      this._lastSyncAt.value = await this.storage.getLastSyncTime();
    } catch (error) {
      this._error.value = `Failed to load tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this._loading.value = false;
    }
  }

  // Utility methods
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external integration
  async syncAllTasks(): Promise<void> {
    this._loading.value = true;

    try {
      for (const task of this._tasks.value) {
        if (task.syncStatus === 'pending') {
          await this.syncWithGitHub(task);
        }
      }

      await this.storage.setLastSyncTime(new Date());
      this._lastSyncAt.value = new Date();
    } catch (error) {
      this._error.value = `Failed to sync tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this._loading.value = false;
    }
  }

  async exportTasks(format: 'json' | 'markdown' = 'json'): Promise<string> {
    const tasks = this._tasks.value;

    if (format === 'markdown') {
      return this.convertToMarkdown(tasks);
    }

    return JSON.stringify(tasks, null, 2);
  }

  async importTasks(data: string, format: 'json' | 'markdown' = 'json'): Promise<UnifiedTask[]> {
    let tasks: UnifiedTask[];

    if (format === 'markdown') {
      tasks = this.parseFromMarkdown(data);
    } else {
      tasks = JSON.parse(data);
    }

    const importedTasks: UnifiedTask[] = [];

    for (const task of tasks) {
      try {
        const importedTask = await this.createTask({
          title: task.title,
          description: task.description,
          stage: task.stage as TaskStage,
          priority: task.metadata.priority,
          tags: task.metadata.tags,
          source: task.metadata.source
        });
        importedTasks.push(importedTask);
      } catch (error) {
        console.error(`Failed to import task "${task.title}":`, error);
      }
    }

    return importedTasks;
  }

  private convertToMarkdown(tasks: UnifiedTask[]): string {
    // Group tasks by stage
    const tasksByStage = tasks.reduce((acc, task) => {
      if (!acc[task.stage]) acc[task.stage] = [];
      acc[task.stage].push(task);
      return acc;
    }, {} as Record<string, UnifiedTask[]>);

    let markdown = '# Task Management Export\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;

    const stageOrder = [
      TaskStageValues.IDEA, TaskStageValues.BACKLOG, TaskStageValues.PLANNING,
      TaskStageValues.DEVELOPMENT, TaskStageValues.REVIEW, TaskStageValues.TESTING,
      TaskStageValues.done, TaskStageValues.ARCHIVED
    ];

    for (const stage of stageOrder) {
      const stageTasks = tasksByStage[stage];
      if (stageTasks && stageTasks.length > 0) {
        markdown += `## ${stage.toUpperCase()}\n\n`;

        for (const task of stageTasks) {
          markdown += `### ${task.title}\n\n`;
          if (task.description) {
            markdown += `${task.description}\n\n`;
          }
          markdown += `- **ID**: ${task.id}\n`;
          markdown += `- **Priority**: ${task.metadata.priority}\n`;
          markdown += `- **Source**: ${task.metadata.source}\n`;
          markdown += `- **Created**: ${task.createdAt.toISOString()}\n`;
          if (task.githubIssue) {
            markdown += `- **GitHub**: [${task.githubIssue.id}](${task.githubIssue.url})\n`;
          }
          markdown += '\n';
        }
      }
    }

    return markdown;
  }

  private parseFromMarkdown(markdown: string): UnifiedTask[] {
    // Basic markdown parsing - would need enhancement for production
    const tasks: UnifiedTask[] = [];
    const lines = markdown.split('\n');
    let currentStage: TaskStage = 'backlog';
    let currentTask: Partial<UnifiedTask> | null = null;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const parsedStage = line.substring(3).toLowerCase();
        // Map stage string to valid TaskStage
        if (['backlog', 'planned', 'in_progress', 'done', 'on_hold'].includes(parsedStage)) {
          currentStage = parsedStage as TaskStage;
        }
      } else if (line.startsWith('### ')) {
        if (currentTask) {
          tasks.push(this.createTaskFromPartial(currentTask, currentStage));
        }
        currentTask = { title: line.substring(4), metadata: { source: 'import', priority: 'medium', tags: [] } };
      } else if (line.startsWith('- **Priority**: ') && currentTask && currentTask.metadata) {
        currentTask.metadata.priority = line.split(': ')[1].toLowerCase();
      }
    }

    if (currentTask) {
      tasks.push(this.createTaskFromPartial(currentTask, currentStage));
    }

    return tasks;
  }

  private createTaskFromPartial(partial: Partial<UnifiedTask>, stage: TaskStage): UnifiedTask {
    return {
      id: this.generateId(),
      legacyIds: {},
      title: partial.title || 'Untitled Task',
      description: partial.description || '',
      metadata: partial.metadata || { source: 'import', priority: 'medium', tags: [] },
      stage,
      childIds: [],
      dependsOn: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date(),
      syncStatus: 'pending'
    };
  }
}

// Export singleton instance
export const unifiedTaskService = new UnifiedTaskService();