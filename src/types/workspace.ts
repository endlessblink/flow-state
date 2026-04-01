// Workspace Collaboration Types

export interface Workspace {
  id: string
  name: string
  ownerId: string
  icon?: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: string
  // Populated from auth.users via join
  displayName?: string
  avatarUrl?: string
  email?: string
}

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  invitedBy: string
  invitedEmail: string
  token: string
  role: WorkspaceRole
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: string
  acceptedAt?: string
  createdAt: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

// TASK-1553: Task Comments
export interface TaskComment {
  id: string
  taskId: string
  userId: string
  content: string
  replyToCommentId: string | null
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  // Populated from member lookup
  userName?: string
  userEmail?: string
}

// TASK-1554: Workspace Activity Feed
export type ActivityAction = 'task_created' | 'task_completed' | 'comment_added' | 'member_joined' | 'member_removed' | 'role_changed' | 'ownership_transferred'
export type ActivityEntityType = 'task' | 'comment' | 'member'

export interface WorkspaceActivity {
  id: string
  workspaceId: string
  userId: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  // Populated from member lookup
  userName?: string
  userEmail?: string
}
