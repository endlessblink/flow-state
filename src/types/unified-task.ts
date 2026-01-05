export interface TaskMetadata {
  source: string;
  priority: string;
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
}

export interface GitHubIssueRef {
  id: string;
  url: string;
}

export interface UnifiedTask {
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

export type TaskStage = 'backlog' | 'planned' | 'in_progress' | 'done' | 'on_hold';

// TaskStage enum-like object for value usage
export const TaskStageValues = {
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

export interface CreateTaskRequest {
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

export interface UpdateTaskRequest {
  id: string;
  updates: Partial<UnifiedTask>;
  stage?: TaskStage;
}

export interface TaskEvent {
  type: string;
  timestamp: Date;
  data: UnifiedTask | { taskId: string };
}

export interface TaskFilter {
  stage?: string;
  priority?: string;
  source?: string;
  tags?: string[];
  search?: string;
  dateRange?: { start: Date; end: Date };
}

export interface TaskSort {
  field: 'title' | 'priority' | 'stage' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}
