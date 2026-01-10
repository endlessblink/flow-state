import type { UnifiedTask } from '@/types/unified-task';

export class IdMappingService {
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
