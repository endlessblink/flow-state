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
