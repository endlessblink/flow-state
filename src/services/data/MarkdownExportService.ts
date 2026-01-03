import { ref, watch } from 'vue'
import { fileSystemService } from './FileSystemService'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import { debounce } from 'lodash'

class MarkdownExportService {
    private isEnabled = ref(false)
    private lastExportTime = ref<Date | null>(null)
    private exportCount = ref(0)
    private isExporting = ref(false)
    private watcherStopHandle: (() => void) | null = null

    // Debounce export to prevent excessive writes (e.g., every 60 seconds of inactivity or max wait 5 mins)
    private debouncedExport = debounce(this.runExport.bind(this), 60000, { maxWait: 300000 })

    /**
     * Initialize and start watching for changes if a directory is selected
     */
    async enableAutoExport(): Promise<boolean> {
        if (!fileSystemService.isFileSystemSupported.value) {
            console.warn('Cannot enable auto-export: File System API not supported')
            return false
        }

        // Ensure we have a directory
        if (!fileSystemService.hasDirectoryHandle()) {
            const selected = await fileSystemService.selectDirectory()
            if (!selected) return false // User cancelled
        }

        // Verify permission
        const hasPermission = await fileSystemService.verifyPermission(true)
        if (!hasPermission) {
            console.warn('Write permission denied for export folder')
            return false
        }

        this.isEnabled.value = true
        this.startWatcher()

        // Run immediate export on enable
        await this.runExport()

        return true
    }

    disableAutoExport() {
        this.isEnabled.value = false
        this.stopWatcher()
    }

    private startWatcher() {
        if (this.watcherStopHandle) return

        const taskStore = useTaskStore()

        // Watch the entire tasks array for structural changes or deep content changes
        this.watcherStopHandle = watch(
            () => taskStore.tasks,
            () => {
                if (this.isEnabled.value) {
                    this.debouncedExport()
                }
            },
            { deep: true }
        )

        console.log('📝 [MarkdownExport] Watcher started')
    }

    private stopWatcher() {
        if (this.watcherStopHandle) {
            this.watcherStopHandle()
            this.watcherStopHandle = null
            console.log('📝 [MarkdownExport] Watcher stopped')
        }
    }

    /**
     * Convert a Task object to a formatted Markdown string
     */
    private convertTaskToMarkdown(task: Task): string {
        const statusIcons = {
            'done': '✅',
            'in_progress': '🔄',
            'planned': '📅',
            'backlog': '📂',
            'on_hold': '⏸️'
        }

        const priorityIcons = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🔵',
            null: '⚪'
        }

        const status = statusIcons[task.status] || '❓'
        const priority = task.priority ? priorityIcons[task.priority] : '⚪'

        const tags = task.tags?.map(t => `#${t}`).join(' ') || ''

        // Frontmatter-like header
        let md = `# ${status} ${task.title}\n\n`
        md += `**ID**: \`${task.id}\`\n`
        md += `**Status**: ${task.status}\n`
        md += `**Priority**: ${task.priority || 'None'} ${priority}\n`
        if (task.dueDate) md += `**Due**: ${task.dueDate}\n`
        if (task.projectId) md += `**Project ID**: \`${task.projectId}\`\n`
        if (tags) md += `**Tags**: ${tags}\n`
        md += `\n---\n\n`

        // Description
        if (task.description) {
            md += `## Description\n\n${task.description}\n\n`
        }

        // Subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            md += `## Subtasks\n`
            task.subtasks.forEach(st => {
                const check = st.isCompleted ? '[x]' : '[ ]'
                md += `- ${check} ${st.title}\n`
            })
            md += `\n`
        }

        // Metadata footer
        md += `---\n`
        md += `*Last Updated: ${new Date().toISOString()}*\n`

        return md
    }

    /**
     * Run the actual export process
     */
    async runExport() {
        if (this.isExporting.value) return
        this.isExporting.value = true

        try {
            console.log('📝 [MarkdownExport] Starting export...')
            const taskStore = useTaskStore()
            const tasks = taskStore.tasks

            // Verify permission before verifying write
            if (!(await fileSystemService.verifyPermission(true))) {
                console.warn('📝 [MarkdownExport] Write permission lost, disabling auto-export')
                this.disableAutoExport()
                return
            }

            // Strategy: Write individual files for safety
            // Filename format: YYYY-MM-DD-TaskTitle.md (sanitized)
            // Folder structure could be flat for MVP

            let count = 0
            for (const task of tasks) {
                // Skip deleted/mock tasks if desired, but for "Nuclear Option" we want everything
                if (task._soft_deleted) continue

                const sanitizedTitle = task.title
                    .replace(/[^a-z0-9]/gi, '_')
                    .substring(0, 50)

                const filename = `${sanitizedTitle}_${task.id}.md`
                const content = this.convertTaskToMarkdown(task)

                await fileSystemService.writeFile(filename, content)
                count++
            }

            this.lastExportTime.value = new Date()
            this.exportCount.value = count
            console.log(`📝 [MarkdownExport] Successfully exported ${count} tasks`)

        } catch (error) {
            console.error('📝 [MarkdownExport] Export failed:', error)
        } finally {
            this.isExporting.value = false
        }
    }

    // Getters for UI
    get status() {
        return {
            isEnabled: this.isEnabled,
            lastExportTime: this.lastExportTime,
            count: this.exportCount,
            isExporting: this.isExporting
        }
    }
}

export const markdownExportService = new MarkdownExportService()
