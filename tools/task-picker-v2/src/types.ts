export type TaskType = 'TASK' | 'BUG' | 'FEATURE' | 'ROAD' | 'IDEA' | 'ISSUE' | 'INQUIRY';

export type Status = 'DONE' | 'IN_PROGRESS' | 'PLANNED' | 'PAUSED' | 'REVIEW';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  status: Status;
  priority?: Priority;
  description?: string;
  isDone: boolean;
  lineNumber: number;
}

export interface FilterOptions {
  status?: Status[];
  type?: TaskType[];
  priority?: Priority[];
  excludeDone?: boolean;
  search?: string;
}
