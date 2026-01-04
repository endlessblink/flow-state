import type { UnifiedTask, GitHubIssueRef } from '@/types/unified-task';

export class GitHubService {
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
