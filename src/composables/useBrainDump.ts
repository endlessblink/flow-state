import { ref, computed } from 'vue'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

export function useBrainDump() {
    const brainDumpMode = ref(false)
    const brainDumpText = ref('')

    // Parse brain dump text to count tasks
    const parsedTaskCount = computed(() => {
        if (!brainDumpText.value.trim()) return 0

        const lines = brainDumpText.value.split('\n').filter(line => line.trim())
        return lines.length
    })

    // Process the brain dump text and create tasks
    const processBrainDump = () => {
        if (!brainDumpText.value.trim()) return

        const lines = brainDumpText.value.split('\n').filter(line => line.trim())
        const { createTaskWithUndo } = useUnifiedUndoRedo()

        lines.forEach(line => {
            // Parse task line for priority, duration, etc.
            const cleanedLine = line.trim()
            let title = cleanedLine
            let priority: 'high' | 'medium' | 'low' | null = null
            let estimatedDuration: number | undefined

            // Extract priority (e.g., "!!!", "!!", "!")
            const priorityMatch = cleanedLine.match(/(!+)$/)
            if (priorityMatch) {
                const exclamationCount = priorityMatch[1].length
                if (exclamationCount >= 3) priority = 'high'
                else if (exclamationCount === 2) priority = 'medium'
                else if (exclamationCount === 1) priority = 'low'
                title = cleanedLine.replace(/\s*!+$/, '').trim()
            }

            // Extract duration (e.g., "2h", "30m")
            const durationMatch = cleanedLine.match(/(\d+)([hm])$/i)
            if (durationMatch) {
                const value = parseInt(durationMatch[1])
                const unit = durationMatch[2].toLowerCase()
                if (unit === 'h') estimatedDuration = value * 60
                else estimatedDuration = value
                title = cleanedLine.replace(/\s*\d+[hm]$/i, '').trim()
            }

            createTaskWithUndo({
                title,
                priority,
                estimatedDuration,
                status: 'planned',
                isInInbox: true
            })
        })

        // Clear brain dump
        brainDumpText.value = ''
        brainDumpMode.value = false
    }

    return {
        brainDumpMode,
        brainDumpText,
        parsedTaskCount,
        processBrainDump
    }
}
