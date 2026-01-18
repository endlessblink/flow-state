import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { CanvasGroup } from '@/types/canvas'

const GUEST_GROUPS_KEY = 'flowstate-guest-groups'

export const useCanvasPersistence = () => {
    const { fetchGroups, saveGroup, deleteGroup: deleteGroupRemote } = useSupabaseDatabase()

    const saveGroupsToLocalStorage = (groups: CanvasGroup[]) => {
        try {
            localStorage.setItem(GUEST_GROUPS_KEY, JSON.stringify(groups))
        } catch (e) {
            console.error('❌ [GUEST-MODE] Failed to save groups to localStorage:', e)
        }
    }

    const loadGroupsFromLocalStorage = (): CanvasGroup[] => {
        try {
            const stored = localStorage.getItem(GUEST_GROUPS_KEY)
            if (stored) {
                return JSON.parse(stored) as CanvasGroup[]
            }
        } catch (e) {
            console.error('❌ [GUEST-MODE] Failed to load groups from localStorage:', e)
        }
        return []
    }

    return {
        fetchGroups,
        saveGroup,
        deleteGroupRemote,
        saveGroupsToLocalStorage,
        loadGroupsFromLocalStorage
    }
}
