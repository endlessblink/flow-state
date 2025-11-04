import { ref, computed } from 'vue'
import type { Task } from '@/types'

/**
 * Canvas Modal State Management Composable
 *
 * Extracted from CanvasView.vue to centralize all modal state
 * and provide a clean interface for modal operations.
 *
 * This composable manages:
 * - Task Edit Modal
 * - Quick Task Create Modal (if exists)
 * - Batch Edit Modal
 * - Group Modal
 * - Section Wizard Modal
 * - Group Edit Modal
 * - Keyboard Test Modal
 */

export interface ModalPosition {
  x: number
  y: number
}

export function useCanvasModals() {
  // Task Edit Modal state
  const isEditModalOpen = ref(false)
  const selectedTask = ref<Task | null>(null)

  // Keyboard Test state
  const showKeyboardTest = ref(false)
  const isTestRunning = ref(false)
  const testStatus = ref('')
  const testResults = ref<Array<{status: 'passed' | 'failed' | 'running', message: string}>>([])

  // Batch Edit Modal state
  const isBatchEditModalOpen = ref(false)
  const batchEditTaskIds = ref<string[]>([])

  // Group Modal state
  const isGroupModalOpen = ref(false)
  const groupModalPosition = ref<ModalPosition>({ x: 100, y: 100 })
  const selectedGroup = ref<any>(null)

  // Section Wizard state
  const isSectionWizardOpen = ref(false)
  const sectionWizardPosition = ref<ModalPosition>({ x: 100, y: 100 })

  // Group Edit Modal state
  const isGroupEditModalOpen = ref(false)
  const selectedSectionForEdit = ref<any>(null)

  // Connection state tracking
  const isConnecting = ref(false)

  // Task Edit Modal methods
  const openEditModal = (task: Task) => {
    selectedTask.value = task
    isEditModalOpen.value = true
    console.log('🔧 CanvasModals: Opening edit modal for task:', task.id)
  }

  const closeEditModal = () => {
    isEditModalOpen.value = false
    selectedTask.value = null
    console.log('🔧 CanvasModals: Closed edit modal')
  }

  // Keyboard Test methods
  const openKeyboardTest = () => {
    showKeyboardTest.value = true
    console.log('🔧 CanvasModals: Opening keyboard test')
  }

  const closeKeyboardTest = () => {
    showKeyboardTest.value = false
    isTestRunning.value = false
    testStatus.value = ''
    testResults.value = []
    console.log('🔧 CanvasModals: Closed keyboard test')
  }

  const startKeyboardTest = () => {
    isTestRunning.value = true
    testStatus.value = 'Running...'
    testResults.value = []
    console.log('🔧 CanvasModals: Starting keyboard test')
  }

  const addTestResult = (result: { status: 'passed' | 'failed' | 'running', message: string }) => {
    testResults.value.push(result)
    console.log('🔧 CanvasModals: Test result:', result)
  }

  const completeKeyboardTest = (status: 'passed' | 'failed', message: string) => {
    isTestRunning.value = false
    testStatus.value = status === 'passed' ? 'All tests passed!' : 'Some tests failed!'
    addTestResult({ status, message })
    console.log('🔧 CanvasModals: Keyboard test completed:', status, message)
  }

  // Batch Edit Modal methods
  const openBatchEditModal = (taskIds: string[]) => {
    batchEditTaskIds.value = taskIds
    isBatchEditModalOpen.value = true
    console.log('🔧 CanvasModals: Opening batch edit modal for tasks:', taskIds)
  }

  const closeBatchEditModal = () => {
    isBatchEditModalOpen.value = false
    batchEditTaskIds.value = []
    console.log('🔧 CanvasModals: Closed batch edit modal')
  }

  const handleBatchEditApplied = () => {
    closeBatchEditModal()
    console.log('🔧 CanvasModals: Batch edit applied, closing modal')
  }

  // Group Modal methods
  const openGroupModal = (position: ModalPosition) => {
    groupModalPosition.value = position
    isGroupModalOpen.value = true
    console.log('🔧 CanvasModals: Set groupModalPosition:', position)
    console.log('🔧 CanvasModals: Setting isGroupModalOpen to true')
  }

  const closeGroupModal = () => {
    isGroupModalOpen.value = false
    groupModalPosition.value = { x: 100, y: 100 }
    selectedGroup.value = null
    console.log('🔧 CanvasModals: Closed group modal')
  }

  // Section Wizard methods
  const openSectionWizard = (position: ModalPosition) => {
    sectionWizardPosition.value = position
    isSectionWizardOpen.value = true
    console.log('🔧 CanvasModals: Setting isSectionWizardOpen to true')
  }

  const closeSectionWizard = () => {
    isSectionWizardOpen.value = false
    console.log('🔧 CanvasModals: Closed section wizard')
  }

  // Group Edit Modal methods
  const openGroupEditModal = (section: any) => {
    selectedSectionForEdit.value = section
    isGroupEditModalOpen.value = true
    console.log('🔧 CanvasModals: Opening group edit modal for section:', section?.id)
  }

  const closeGroupEditModal = () => {
    isGroupEditModalOpen.value = false
    selectedSectionForEdit.value = null
    closeGroupModal()
    console.log('🔧 CanvasModals: Closed group edit modal')
  }

  // Connection state methods
  const startConnecting = () => {
    isConnecting.value = true
    console.log('🔧 CanvasModals: Starting connection mode')
  }

  const stopConnecting = () => {
    isConnecting.value = false
    console.log('🔧 CanvasModals: Stopped connection mode')
  }

  // Modal state checks
  const hasOpenModal = computed(() => {
    return isEditModalOpen.value ||
           showKeyboardTest.value ||
           isBatchEditModalOpen.value ||
           isGroupModalOpen.value ||
           isSectionWizardOpen.value ||
           isGroupEditModalOpen.value
  })

  // Modal count for debugging
  const openModalCount = computed(() => {
    let count = 0
    if (isEditModalOpen.value) count++
    if (showKeyboardTest.value) count++
    if (isBatchEditModalOpen.value) count++
    if (isGroupModalOpen.value) count++
    if (isSectionWizardOpen.value) count++
    if (isGroupEditModalOpen.value) count++
    return count
  })

  return {
    // State
    isEditModalOpen,
    selectedTask,
    showKeyboardTest,
    isTestRunning,
    testStatus,
    testResults,
    isBatchEditModalOpen,
    batchEditTaskIds,
    isGroupModalOpen,
    groupModalPosition,
    selectedGroup,
    isSectionWizardOpen,
    sectionWizardPosition,
    isGroupEditModalOpen,
    selectedSectionForEdit,
    isConnecting,

    // Computed
    hasOpenModal,
    openModalCount,

    // Task Edit Modal methods
    openEditModal,
    closeEditModal,

    // Keyboard Test methods
    openKeyboardTest,
    closeKeyboardTest,
    startKeyboardTest,
    addTestResult,
    completeKeyboardTest,

    // Batch Edit Modal methods
    openBatchEditModal,
    closeBatchEditModal,
    handleBatchEditApplied,

    // Group Modal methods
    openGroupModal,
    closeGroupModal,

    // Section Wizard methods
    openSectionWizard,
    closeSectionWizard,

    // Group Edit Modal methods
    openGroupEditModal,
    closeGroupEditModal,

    // Connection state methods
    startConnecting,
    stopConnecting
  }
}