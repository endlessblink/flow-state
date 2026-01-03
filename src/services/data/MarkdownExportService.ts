import { ref, watch } from 'vue'
import { fileSystemService } from './FileSystemService'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import { debounce } from 'lodash'
import JSZip from 'jszip'

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

    /**
     * Fallback for browsers without File System Access API
     * Create a ZIP file of all tasks and trigger download
     */
    async downloadAsZip() {
        if (this.isExporting.value) return
        this.isExporting.value = true

        try {
            console.log('📦 [MarkdownExport] Creating ZIP export...')
            const taskStore = useTaskStore()
            const tasks = taskStore.tasks
            const zip = new JSZip()

            // Create tasks folder in zip
            const folder = zip.folder("tasks_backup_" + new Date().toISOString().split('T')[0])
            if (!folder) throw new Error("Failed to create zip folder")

            let count = 0
            for (const task of tasks) {
                if (task._soft_deleted) continue

                const sanitizedTitle = task.title
                    .replace(/[^a-z0-9]/gi, '_')
                    .substring(0, 50)
                const filename = `${sanitizedTitle}_${task.id}.md`
                const content = this.convertTaskToMarkdown(task)

                folder.file(filename, content)
                count++
            }

            // Generate and download
            const blob = await zip.generateAsync({ type: "blob" })
            const url = URL.createObjectURL(blob)

            const a = document.createElement('a')
            a.href = url
            a.download = `pomo_flow_backup_${new Date().toISOString().slice(0, 10)}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            this.lastExportTime.value = new Date()
            this.exportCount.value = count
            console.log(`📦 [MarkdownExport] ZIP download triggered for ${count} tasks`)
        } catch (error) {
            console.error('📦 [MarkdownExport] ZIP generation failed:', error)
        } finally {
            this.isExporting.value = false
        }
    }

    /**
     * Import tasks from a ZIP file containing Markdown files
     */
    async importFromZip(file: File): Promise<number> {
        if (this.isExporting.value) throw new Error('Export in progress')
        this.isExporting.value = true

        try {
            console.log('📦 [MarkdownImport] Reading ZIP file...')
            const zip = await JSZip.loadAsync(file)
            const taskStore = useTaskStore()

            const tasksToRestore: Task[] = []

            // Iterate over all files in the zip
            const files = Object.keys(zip.files)
            for (const filename of files) {
                if (!filename.endsWith('.md') || filename.includes('__MACOSX')) continue

                const content = await zip.files[filename].async('string')
                const task = this.parseMarkdownToTask(content)
                if (task) {
                    tasksToRestore.push(task)
                }
            }

            if (tasksToRestore.length === 0) {
                throw new Error('No valid Markdown tasks found in ZIP')
            }

            console.log(`📦 [MarkdownImport] Found ${tasksToRestore.length} tasks. Restoring...`)

            // Batch restore
            await taskStore.importTasks(tasksToRestore)

            return tasksToRestore.length
        } catch (error) {
            console.error('📦 [MarkdownImport] Import failed:', error)
            throw error
        } finally {
            this.isExporting.value = false
        }
    }

    /**
     * Parse a Markdown string back into a Task object
     */
    private parseMarkdownToTask(md: string): Task | null {
        try {
            const lines = md.split('\n')

            // 1. Extract Title and Status Icon (Line 0)
            // Format: # ✅ Task Title
            const titleLine = lines[0] || ''
            const titleMatch = titleLine.match(/^#\s+(?:.\s+)?(.*)$/)
            const title = titleMatch ? titleMatch[1].trim() : 'Untitled Task'

            // 2. Extract Metadata
            const idMatch = md.match(/\*\*ID\*\*: `(.*)`/)
            const statusMatch = md.match(/\*\*Status\*\*: (.*)/)
            const priorityMatch = md.match(/\*\*Priority\*\*: (\w+)/) // Only grabs the word 'high', 'low' etc
            const projectMatch = md.match(/\*\*Project ID\*\*: `(.*)`/)
            const dueMatch = md.match(/\*\*Due\*\*: (.*)/)
            const tagsMatch = md.match(/\*\*Tags\*\*: (.*)/)

            // 3. Extract Description
            // Look for "## Description" and take everything until "## Subtasks" or "---"
            let description = ''
            const descStart = lines.findIndex(l => l.includes('## Description'))
            if (descStart !== -1) {
                let descEnd = lines.findIndex((l, i) => i > descStart && (l.includes('## Subtasks') || l.startsWith('---') && i > descStart + 2)) // Skip first sep
                if (descEnd === -1) descEnd = lines.length

                description = lines.slice(descStart + 2, descEnd).join('\n').trim()
            }

            // 4. Extract Subtasks
            const subtasks: any[] = []
            const subStart = lines.findIndex(l => l.includes('## Subtasks'))
            if (subStart !== -1) {
                for (let i = subStart + 1; i < lines.length; i++) {
                    const line = lines[i].trim()
                    const match = line.match(/- \[(x| )\] (.*)/)
                    if (match) {
                        subtasks.push({
                            id: crypto.randomUUID(), // Generate new IDs for subtasks as they aren't preserved in simple MD
                            title: match[2],
                            isCompleted: match[1] === 'x'
                        })
                    }
                }
            }

            // Construct Task
            const task: any = {
                id: idMatch ? idMatch[1] : crypto.randomUUID(),
                title: title,
                status: (statusMatch ? statusMatch[1].trim() : 'planned') as any,
                priority: (priorityMatch ? priorityMatch[1].toLowerCase() : 'medium') as any,
                projectId: projectMatch ? projectMatch[1] : null,
                dueDate: dueMatch ? dueMatch[1].trim() : null,
                tags: tagsMatch ? tagsMatch[1].replace(/#/g, '').split(' ') : [],
                description: description,
                subtasks: subtasks,
                createdAt: new Date(), // Reset creation time as it's a restore
                updatedAt: new Date()
            }

            // Basic validation
            if (!task.id || !task.title) return null

            return task
        } catch (e) {
            console.warn('Failed to parse task markdown:', e)
            return null
        }
    }

    // Getters for UI
    get status() {
        return {
            isEnabled: this.isEnabled,
            lastExportTime: this.lastExportTime,
            count: this.exportCount,
            isExporting: this.isExporting,
            isSupported: fileSystemService.isFileSystemSupported
        }
    }
}

export const markdownExportService = new MarkdownExportService()
