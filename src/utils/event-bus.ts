import type { UnifiedTask } from '@/types/unified-task';

export interface EventData {
  type: string;
  taskId: string;
  data: UnifiedTask;
  source: string;
  timestamp: Date;
}

export class EventBus {
  emit(_event: string, _data: EventData): void {
    console.log('Mock EventBus.emit called');
  }

  on(_event: string, _callback: (...args: any[]) => void): void {
    console.log('Mock EventBus.on called');
  }
}
