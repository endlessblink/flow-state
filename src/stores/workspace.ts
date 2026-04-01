import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Workspace, WorkspaceMember, WorkspaceInvite, WorkspaceRole } from '@/types/workspace'

const LAST_WORKSPACE_KEY = 'flowstate-last-workspace'

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const workspaces = ref<Workspace[]>([])
  const activeWorkspaceId = ref<string | null>(null) // null = personal workspace
  const members = ref<Map<string, WorkspaceMember[]>>(new Map())
  const isLoading = ref(false)
  const isSwitchingWorkspace = ref(false)

  // Computed
  const activeWorkspace = computed(() =>
    activeWorkspaceId.value
      ? workspaces.value.find(w => w.id === activeWorkspaceId.value) || null
      : null
  )

  const isPersonalWorkspace = computed(() => activeWorkspaceId.value === null)

  // TASK-1550: Guest mode isolation — true when user is not authenticated
  const isGuestMode = computed(() => {
    const authStore = useAuthStore()
    return !authStore.isAuthenticated
  })

  // TASK-1555: Hide switcher when user has only 1 workspace (auto-activated, no choice to make)
  const shouldShowSwitcher = computed(() => workspaces.value.length > 1)

  const activeMembers = computed(() =>
    activeWorkspaceId.value
      ? members.value.get(activeWorkspaceId.value) || []
      : []
  )

  const userRole = computed((): WorkspaceRole | null => {
    const authStore = useAuthStore()
    if (!activeWorkspaceId.value || !authStore.user?.id) return null
    const memberList = members.value.get(activeWorkspaceId.value) || []
    const me = memberList.find(m => m.userId === authStore.user!.id)
    return me?.role || null
  })

  const canManageMembers = computed(() => {
    return userRole.value === 'owner' || userRole.value === 'admin'
  })

  const isOwner = computed(() => userRole.value === 'owner')

  // Actions

  async function loadWorkspaces() {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !supabase) return

    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          workspaces:workspace_id (
            id, name, owner_id, icon, color, created_at, updated_at
          )
        `)
        .eq('user_id', authStore.user!.id)

      if (error) {
        console.error('[WORKSPACE] Failed to load workspaces:', error)
        return
      }

      workspaces.value = (data || [])
        .filter((row: any) => row.workspaces)
        .map((row: any) => ({
          id: row.workspaces.id,
          name: row.workspaces.name,
          ownerId: row.workspaces.owner_id,
          icon: row.workspaces.icon,
          color: row.workspaces.color || '#4ECDC4',
          createdAt: row.workspaces.created_at,
          updatedAt: row.workspaces.updated_at,
        }))

      // Restore last-used workspace from localStorage
      const lastWsId = localStorage.getItem(LAST_WORKSPACE_KEY)
      if (lastWsId && workspaces.value.some(w => w.id === lastWsId)) {
        activeWorkspaceId.value = lastWsId
      } else if (workspaces.value.length === 1) {
        // TASK-1555: Single-workspace users auto-land in their shared workspace
        activeWorkspaceId.value = workspaces.value[0].id
      }

      console.log(`[WORKSPACE] Loaded ${workspaces.value.length} workspace(s)`)
    } catch (e) {
      console.error('[WORKSPACE] Error loading workspaces:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function switchWorkspace(id: string | null) {
    // TASK-1550: Guest mode isolation — prevent unauthenticated DB loads
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    if (id === activeWorkspaceId.value) return

    console.log(`[WORKSPACE] Switching: ${activeWorkspaceId.value || 'personal'} → ${id || 'personal'}`)

    isSwitchingWorkspace.value = true  // Pause sync queue

    activeWorkspaceId.value = id

    if (id) {
      localStorage.setItem(LAST_WORKSPACE_KEY, id)
    } else {
      localStorage.removeItem(LAST_WORKSPACE_KEY)
    }

    if (id) {
      await loadMembers(id)
    }

    // Invalidate SWR cache to force fresh workspace-aware queries
    try {
      const { invalidateCache } = await import('@/composables/supabase/_infrastructure')
      invalidateCache.all()
    } catch { /* cache not available */ }

    try {
      // Dynamic imports to avoid circular dependencies
      const { useTaskStore } = await import('@/stores/tasks')
      const { useProjectStore } = await import('@/stores/projects')
      const { useCanvasStore } = await import('@/stores/canvas')

      await Promise.all([
        useTaskStore().loadFromDatabase(),
        useProjectStore().loadProjectsFromDatabase(),
        useCanvasStore().loadFromDatabase(),
      ])
    } finally {
      isSwitchingWorkspace.value = false  // Resume sync queue
    }
  }

  async function createWorkspace(name: string): Promise<Workspace | null> {
    const authStore = useAuthStore()
    if (!authStore.user?.id || !supabase) return null

    try {
      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .insert({ name, owner_id: authStore.user.id })
        .select()
        .single()

      if (wsError) throw wsError

      const { error: memError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: ws.id,
          user_id: authStore.user.id,
          role: 'owner',
        })

      if (memError) throw memError

      const workspace: Workspace = {
        id: ws.id,
        name: ws.name,
        ownerId: ws.owner_id,
        icon: ws.icon,
        color: ws.color || '#4ECDC4',
        createdAt: ws.created_at,
        updatedAt: ws.updated_at,
      }

      workspaces.value.push(workspace)
      console.log(`[WORKSPACE] Created workspace: ${name} (${ws.id})`)
      return workspace
    } catch (e) {
      console.error('[WORKSPACE] Failed to create workspace:', e)
      return null
    }
  }

  async function acceptInvite(
    token: string
  ): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase not available' }

    try {
      const { data, error } = await supabase.rpc('accept_workspace_invite', { p_token: token })

      if (error) throw error

      const result = data as {
        status: string
        workspace_id?: string
        role?: string
        message?: string
      }

      if (result.status === 'success' && result.workspace_id) {
        await loadWorkspaces()
        // TASK-1554: Log activity for member joining (fire-and-forget)
        import('@/composables/supabase/useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
          useWorkspaceActivity().logActivity(
            result.workspace_id!,
            'member_joined',
            'member',
            useAuthStore().user?.id ?? null,
            {}
          )
        }).catch(() => {})
        return { success: true, workspaceId: result.workspace_id }
      }

      return { success: false, error: result.message || 'Invite acceptance failed' }
    } catch (e: any) {
      console.error('[WORKSPACE] Failed to accept invite:', e)
      return { success: false, error: e.message || 'Unknown error' }
    }
  }

  async function loadMembers(workspaceId: string) {
    // TASK-1550: Guest mode isolation
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('id, workspace_id, user_id, role, joined_at')
        .eq('workspace_id', workspaceId)

      if (error) {
        console.error('[WORKSPACE] Failed to load members:', error)
        return
      }

      const memberList: WorkspaceMember[] = (data || []).map((row: any) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
        displayName: row.user_id.substring(0, 8),
        avatarUrl: undefined,
        email: undefined,
      }))

      members.value.set(workspaceId, memberList)
    } catch (e) {
      console.error('[WORKSPACE] Error loading members:', e)
    }
  }

  async function generateInviteLink(
    workspaceId: string,
    email: string,
    role: WorkspaceRole = 'member'
  ): Promise<string | null> {
    const authStore = useAuthStore()
    if (!authStore.user?.id || !supabase) return null

    try {
      const { data, error } = await supabase
        .from('workspace_invites')
        .insert({
          workspace_id: workspaceId,
          invited_by: authStore.user.id,
          invited_email: email,
          role,
        })
        .select('token')
        .single()

      if (error) throw error

      const baseUrl = window.location.origin
      return `${baseUrl}/#/invite/${data.token}`
    } catch (e) {
      console.error('[WORKSPACE] Failed to generate invite:', e)
      return null
    }
  }

  async function deleteWorkspace(id: string): Promise<boolean> {
    // TASK-1550: Guest mode isolation
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !supabase) return false

    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id)

      if (error) throw error

      workspaces.value = workspaces.value.filter(w => w.id !== id)
      members.value.delete(id)

      // If we deleted the active workspace, switch to personal
      if (activeWorkspaceId.value === id) {
        await switchWorkspace(null)
      }

      console.log(`[WORKSPACE] Deleted workspace: ${id}`)
      return true
    } catch (e) {
      console.error('[WORKSPACE] Failed to delete workspace:', e)
      return false
    }
  }

  async function removeMember(memberId: string): Promise<boolean> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !supabase || !activeWorkspaceId.value) return false

    // Find the member to check guards
    const memberList = members.value.get(activeWorkspaceId.value) || []
    const target = memberList.find(m => m.id === memberId)
    if (!target) return false

    // Prevent removing the owner
    if (target.role === 'owner') {
      console.error('[WORKSPACE] Cannot remove workspace owner')
      return false
    }

    // Self-removal (leave) is always allowed; removing others requires canManageMembers
    const isSelf = target.userId === authStore.user?.id
    if (!isSelf && !canManageMembers.value) {
      console.error('[WORKSPACE] Insufficient permissions to remove member')
      return false
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      // Update local state
      const updated = memberList.filter(m => m.id !== memberId)
      members.value.set(activeWorkspaceId.value!, updated)

      // Log activity (fire-and-forget)
      import('@/composables/supabase/useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
        useWorkspaceActivity().logActivity(
          activeWorkspaceId.value!,
          'member_removed',
          'member',
          target.userId,
          {}
        )
      }).catch(() => {})

      console.log(`[WORKSPACE] Removed member: ${memberId}`)

      // If self-removal, switch to personal workspace
      if (isSelf) {
        workspaces.value = workspaces.value.filter(w => w.id !== activeWorkspaceId.value)
        await switchWorkspace(null)
      }

      return true
    } catch (e) {
      console.error('[WORKSPACE] Failed to remove member:', e)
      return false
    }
  }

  async function updateMemberRole(memberId: string, newRole: WorkspaceRole): Promise<boolean> {
    if (!supabase || !activeWorkspaceId.value || !canManageMembers.value) return false

    const memberList = members.value.get(activeWorkspaceId.value) || []
    const target = memberList.find(m => m.id === memberId)
    if (!target) return false

    // Cannot change the owner's role (use transferOwnership instead)
    if (target.role === 'owner') {
      console.error('[WORKSPACE] Cannot change owner role directly — use transferOwnership')
      return false
    }

    // Admins cannot promote to owner
    if (newRole === 'owner') {
      console.error('[WORKSPACE] Cannot set owner role — use transferOwnership')
      return false
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error

      // Update local state
      const idx = memberList.findIndex(m => m.id === memberId)
      if (idx !== -1) {
        memberList[idx] = { ...memberList[idx], role: newRole }
        members.value.set(activeWorkspaceId.value!, [...memberList])
      }

      // Log activity (fire-and-forget)
      import('@/composables/supabase/useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
        useWorkspaceActivity().logActivity(
          activeWorkspaceId.value!,
          'role_changed',
          'member',
          target.userId,
          { newRole }
        )
      }).catch(() => {})

      console.log(`[WORKSPACE] Updated member ${memberId} role to ${newRole}`)
      return true
    } catch (e) {
      console.error('[WORKSPACE] Failed to update member role:', e)
      return false
    }
  }

  async function transferOwnership(newOwnerId: string): Promise<boolean> {
    if (!supabase || !activeWorkspaceId.value || !isOwner.value) return false

    try {
      const { data, error } = await supabase.rpc('transfer_workspace_ownership', {
        p_workspace_id: activeWorkspaceId.value,
        p_new_owner_id: newOwnerId,
      })

      if (error) throw error

      const result = data as { status: string; message?: string }
      if (result.status !== 'success') {
        console.error('[WORKSPACE] Transfer failed:', result.message)
        return false
      }

      // Log activity (fire-and-forget)
      import('@/composables/supabase/useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
        useWorkspaceActivity().logActivity(
          activeWorkspaceId.value!,
          'ownership_transferred',
          'member',
          newOwnerId,
          {}
        )
      }).catch(() => {})

      // Reload to reflect new ownership
      await loadWorkspaces()
      if (activeWorkspaceId.value) {
        await loadMembers(activeWorkspaceId.value)
      }

      console.log(`[WORKSPACE] Transferred ownership to ${newOwnerId}`)
      return true
    } catch (e) {
      console.error('[WORKSPACE] Failed to transfer ownership:', e)
      return false
    }
  }

  function clearAll() {
    workspaces.value = []
    activeWorkspaceId.value = null
    members.value = new Map()
    localStorage.removeItem(LAST_WORKSPACE_KEY)
  }

  return {
    // State
    workspaces,
    activeWorkspaceId,
    members,
    isLoading,
    isSwitchingWorkspace,

    // Computed
    activeWorkspace,
    isPersonalWorkspace,
    isGuestMode,
    shouldShowSwitcher,
    activeMembers,
    userRole,

    // Actions
    loadWorkspaces,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    acceptInvite,
    loadMembers,
    generateInviteLink,
    clearAll,
  }
})
