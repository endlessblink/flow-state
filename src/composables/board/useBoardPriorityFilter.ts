import type { RemovableRef } from '@vueuse/core'
import { usePersistentRef } from '@/composables/usePersistentRef'

let sharedPriorityFilter: RemovableRef<string> | undefined

export function useBoardPriorityFilter(): RemovableRef<string> {
  sharedPriorityFilter ??= usePersistentRef<string>('flowstate:board-priority-filter', '', 'board-priority-filter')
  return sharedPriorityFilter
}
