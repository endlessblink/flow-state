import type { UnifiedTask, GitHubIssueRef } from '@/types/unified-task';

/**
 * Mock GitHubService - placeholder for future GitHub integration
 * Note: Not currently used in production
 */
export class GitHubService {
  async sync(_tasks: UnifiedTask[]): Promise<void> {
    // Mock implementation - no-op
  }

  async createIssue(_task: UnifiedTask): Promise<GitHubIssueRef> {
    return { id: 'mock-issue-id', url: 'https://github.com/mock' };
  }

  async updateIssue(_task: UnifiedTask): Promise<void> {
    // Mock implementation - no-op
  }

  async closeIssue(_issueId: string): Promise<void> {
    // Mock implementation - no-op
  }
}
