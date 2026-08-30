<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle, Check, ChevronDown, Pencil, RotateCcw, Sparkles, X } from 'lucide-vue-next'
import type {
  AICommand,
  AICommandAuditEntry,
  AICommandBatch,
  AICommandPreviewItem,
} from '@/services/ai/actionCommands'

export type AICommandCenterStepStatus = 'pending' | 'running' | 'completed' | 'waiting_approval' | 'failed'

export type AICommandCenterStep = {
  id: string
  label: string
  status: AICommandCenterStepStatus
  message?: string
  retryable?: boolean
}

const props = withDefaults(defineProps<{
  batch: AICommandBatch
  title: string
  why: string
  sources?: string[]
  steps?: AICommandCenterStep[]
  busy?: boolean
  error?: string
  auditEntry?: AICommandAuditEntry | null
  auditTrail?: AICommandAuditEntry[]
}>(), {
  sources: () => [],
  steps: () => [],
  busy: false,
  error: '',
  auditEntry: null,
  auditTrail: () => [],
})

const emit = defineEmits<{
  apply: [payload: { selectedCommandIds: string[]; commands: AICommand[]; explicitApproval: boolean }]
  retry: [stepId: string]
  undo: [rollbackPointer: string]
}>()

const selectedCommandIds = ref(new Set<string>())
const editedCommands = ref<AICommand[]>([])
const editingIds = ref(new Set<string>())
const explicitApproval = ref(false)
const expandedIds = ref(new Set<string>())

function resetFromBatch(batch: AICommandBatch) {
  editedCommands.value = JSON.parse(JSON.stringify(batch.commands)) as AICommand[]
  selectedCommandIds.value = new Set(batch.commands.map(command => command.id))
  editingIds.value = new Set()
  explicitApproval.value = false
  expandedIds.value = new Set(batch.preview.commands.map(command => command.id))
}

watch(() => props.batch, resetFromBatch, { immediate: true, deep: true })

const selectedPreviews = computed(() => props.batch.preview.commands.filter(command => selectedCommandIds.value.has(command.id)))
const needsExplicitApproval = computed(() => selectedPreviews.value.some(command => command.requiresExplicitApproval))
const canApply = computed(() => (
  selectedCommandIds.value.size > 0 &&
  !props.busy &&
  (!needsExplicitApproval.value || explicitApproval.value)
))

function commandFor(id: string): AICommand | undefined {
  return editedCommands.value.find(command => command.id === id)
}

function commandTitle(command: AICommand): string {
  if ('title' in command && typeof command.title === 'string') return command.title
  if (command.kind === 'lane.create') return command.name
  if (command.kind === 'task.update') return `Update task ${command.taskId}`
  if (command.kind === 'task.delete') return `Delete task ${command.taskId}`
  if (command.kind === 'calendar.schedule_task') return `Schedule task ${command.taskId}`
  if (command.kind === 'focus.timer.start') return `Start focus on ${command.taskId}`
  if (command.kind === 'focus.timer.stop') return 'Stop focus timer'
  if (command.kind === 'canvas.group.create') return command.name
  if (command.kind === 'canvas.node.move') return `Move ${command.nodeType} ${command.nodeId}`
  if (command.kind === 'memory.patch') return `Update ${command.patch.field}`
  return 'Record recommendation feedback'
}

type EditableCommandField = {
  key: 'title' | 'name' | 'dueDate'
  value: string
  inputType: 'text' | 'date'
}

function editableField(command: AICommand): EditableCommandField | null {
  if ('title' in command && typeof command.title === 'string') {
    return { key: 'title', value: command.title, inputType: 'text' }
  }
  if (command.kind === 'lane.create' || command.kind === 'canvas.group.create') {
    return { key: 'name', value: command.name, inputType: 'text' }
  }
  if (command.kind === 'task.update' && typeof command.updates.dueDate === 'string') {
    return { key: 'dueDate', value: command.updates.dueDate, inputType: 'date' }
  }
  return null
}

function updateEditableValue(commandId: string, value: string) {
  const command = commandFor(commandId)
  if (!command) return
  if ('title' in command && typeof command.title === 'string') {
    command.title = value
  } else if (command.kind === 'lane.create' || command.kind === 'canvas.group.create') {
    command.name = value
  } else if (command.kind === 'task.update' && typeof command.updates.dueDate === 'string') {
    command.updates.dueDate = value
  }
}

function editorTestId(command: AICommand): string {
  return editableField(command)?.key === 'dueDate'
    ? `ai-command-value-${command.id}`
    : `ai-command-title-${command.id}`
}

function toggleSelected(commandId: string) {
  const next = new Set(selectedCommandIds.value)
  if (next.has(commandId)) next.delete(commandId)
  else next.add(commandId)
  selectedCommandIds.value = next
}

function toggleEditing(commandId: string) {
  const next = new Set(editingIds.value)
  if (next.has(commandId)) next.delete(commandId)
  else next.add(commandId)
  editingIds.value = next
}

function toggleExpanded(commandId: string) {
  const next = new Set(expandedIds.value)
  if (next.has(commandId)) next.delete(commandId)
  else next.add(commandId)
  expandedIds.value = next
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'None'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function diffRows(value: Record<string, unknown> | null): Array<[string, string]> {
  if (!value) return []
  return Object.entries(value).map(([key, item]) => [key, displayValue(item)])
}

function effectiveAfter(preview: AICommandPreviewItem): Record<string, unknown> | null {
  if (!preview.diff.after) return null
  const command = commandFor(preview.id)
  const field = command ? editableField(command) : null
  if (!field) return preview.diff.after
  return {
    ...preview.diff.after,
    [field.key]: field.value,
  }
}

function statusLabel(preview: AICommandPreviewItem): string {
  if (preview.status === 'will_reuse_existing') return 'Already matches an existing item'
  if (preview.status === 'blocked_requires_approval') return 'Needs explicit approval'
  return 'Ready to apply'
}

function canUndoEntry(entry: AICommandAuditEntry): boolean {
  return entry.rollbackVersion === 2
}

function applySelected() {
  if (!canApply.value) return
  emit('apply', {
    selectedCommandIds: props.batch.commands
      .map(command => command.id)
      .filter(id => selectedCommandIds.value.has(id)),
    commands: editedCommands.value,
    explicitApproval: explicitApproval.value,
  })
}
</script>

<template>
  <section class="command-center" data-testid="ai-command-center">
    <header class="command-center__header">
      <span class="command-center__icon"><Sparkles :size="16" /></span>
      <div>
        <p class="command-center__eyebrow">
          AI proposal
        </p>
        <h3>{{ title }}</h3>
      </div>
    </header>

    <div class="command-center__why">
      <strong>Why this</strong>
      <p>{{ why }}</p>
      <ul v-if="sources.length">
        <li v-for="source in sources" :key="source">
          {{ source }}
        </li>
      </ul>
    </div>

    <ol v-if="steps.length" class="command-center__steps" aria-label="Agent progress">
      <li v-for="step in steps" :key="step.id" :class="`is-${step.status}`">
        <span class="step-dot"><Check v-if="step.status === 'completed'" :size="11" /></span>
        <span class="step-copy">
          <strong>{{ step.label }}</strong>
          <small v-if="step.message">{{ step.message }}</small>
        </span>
        <button
          v-if="step.status === 'failed' && step.retryable"
          :data-testid="`ai-command-retry-${step.id}`"
          type="button"
          class="step-retry"
          @click="emit('retry', step.id)"
        >
          Retry
        </button>
      </li>
    </ol>

    <div class="command-center__commands">
      <article
        v-for="preview in batch.preview.commands"
        :key="preview.id"
        class="command-item"
        :class="{ 'is-rejected': !selectedCommandIds.has(preview.id) }"
      >
        <div class="command-item__summary">
          <button
            :data-testid="`ai-command-expand-${preview.id}`"
            type="button"
            class="command-expand"
            :aria-label="`${expandedIds.has(preview.id) ? 'Hide' : 'Show'} details for ${commandFor(preview.id) ? commandTitle(commandFor(preview.id)!) : preview.kind}`"
            :aria-expanded="expandedIds.has(preview.id)"
            :aria-controls="`ai-command-details-${preview.id}`"
            @click="toggleExpanded(preview.id)"
          >
            <ChevronDown :size="14" :class="{ collapsed: !expandedIds.has(preview.id) }" />
          </button>
          <div class="command-item__title">
            <strong>{{ commandFor(preview.id) ? commandTitle(commandFor(preview.id)!) : preview.kind }}</strong>
            <small>{{ preview.kind }} · {{ statusLabel(preview) }}</small>
          </div>
          <button
            v-if="commandFor(preview.id) && editableField(commandFor(preview.id)!) !== null"
            :data-testid="`ai-command-edit-${preview.id}`"
            type="button"
            class="command-icon-btn"
            title="Edit proposal"
            :aria-label="`Edit proposed change for ${commandTitle(commandFor(preview.id)!)}`"
            @click="toggleEditing(preview.id)"
          >
            <Pencil :size="13" />
          </button>
          <button
            :data-testid="`ai-command-reject-${preview.id}`"
            type="button"
            class="command-reject"
            @click="toggleSelected(preview.id)"
          >
            <RotateCcw v-if="!selectedCommandIds.has(preview.id)" :size="13" />
            <X v-else :size="13" />
            {{ selectedCommandIds.has(preview.id) ? 'Reject' : 'Restore' }}
          </button>
        </div>

        <input
          v-if="editingIds.has(preview.id) && commandFor(preview.id) && editableField(commandFor(preview.id)!) !== null"
          :data-testid="editorTestId(commandFor(preview.id)!)"
          class="command-edit-input"
          :value="editableField(commandFor(preview.id)!)!.value"
          :type="editableField(commandFor(preview.id)!)!.inputType"
          aria-label="Edit proposed value"
          @input="updateEditableValue(preview.id, ($event.target as HTMLInputElement).value)"
        >

        <div v-if="expandedIds.has(preview.id)" :id="`ai-command-details-${preview.id}`" class="command-item__details">
          <div class="command-diff">
            <div>
              <span>Before</span>
              <p v-if="diffRows(preview.diff.before).length === 0">
                Nothing
              </p>
              <p v-for="[key, value] in diffRows(preview.diff.before)" :key="`before-${key}`">
                <b>{{ key }}</b>: {{ value }}
              </p>
            </div>
            <div>
              <span>After</span>
              <p v-for="[key, value] in diffRows(effectiveAfter(preview))" :key="`after-${key}`">
                <b>{{ key }}</b>: {{ value }}
              </p>
            </div>
          </div>
          <div class="command-identity">
            <span>Scope: {{ preview.identity.scope }}</span>
            <span v-if="preview.duplicateOf">Match: {{ preview.duplicateOf }}</span>
            <span>Identity: {{ preview.identity.fingerprint }}</span>
          </div>
        </div>
      </article>
    </div>

    <label v-if="needsExplicitApproval" class="command-approval">
      <input v-model="explicitApproval" data-testid="ai-command-approval" type="checkbox">
      <AlertTriangle :size="14" />
      I reviewed and approve the high-impact changes
    </label>

    <p v-if="error" class="command-error">
      {{ error }}
    </p>

    <details v-if="auditTrail.length" class="command-history">
      <summary>Recent AI actions</summary>
      <div v-for="entry in auditTrail" :key="entry.rollbackPointer" class="command-history__item">
        <span>
          <strong>{{ entry.sourcePrompt }}</strong>
          <small>{{ entry.commandsApplied.length }} applied · {{ entry.commandsRejected.length }} rejected</small>
        </span>
        <button
          v-if="canUndoEntry(entry)"
          :data-testid="`ai-command-history-undo-${entry.rollbackPointer}`"
          type="button"
          class="command-secondary"
          @click="emit('undo', entry.rollbackPointer)"
        >
          <RotateCcw :size="13" /> Undo
        </button>
        <small v-else class="command-history__unavailable">Undo unavailable</small>
      </div>
    </details>

    <footer class="command-center__footer">
      <span>{{ selectedCommandIds.size }} of {{ batch.commands.length }} selected</span>
      <button
        v-if="auditEntry && canUndoEntry(auditEntry)"
        data-testid="ai-command-undo"
        type="button"
        class="command-secondary"
        @click="emit('undo', auditEntry.rollbackPointer)"
      >
        <RotateCcw :size="14" /> Undo
      </button>
      <button
        data-testid="ai-command-apply"
        type="button"
        class="command-primary"
        :disabled="!canApply || Boolean(auditEntry)"
        @click="applySelected"
      >
        {{ auditEntry ? 'Applied' : busy ? 'Applying…' : 'Apply selected' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.command-center {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--accent-primary) 28%, var(--border-subtle));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-primary) 94%, var(--accent-primary));
  color: var(--text-primary);
}

.command-center__header,
.command-item__summary,
.command-center__footer,
.command-approval,
.command-center__steps li {
  display: flex;
  align-items: center;
}

.command-center__header { gap: var(--space-2); }
.command-center__header h3 { margin: 0; font-size: var(--text-base); }
.command-center__eyebrow { margin: 0 0 2px; color: var(--accent-primary); font-size: var(--text-xs); font-weight: var(--font-semibold); text-transform: uppercase; letter-spacing: .05em; }
.command-center__icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-md); color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 12%, transparent); }
.command-center__why { padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--surface-secondary); font-size: var(--text-sm); }
.command-center__why p { margin: var(--space-1) 0; }
.command-center__why ul { margin: var(--space-1) 0 0; padding-inline-start: var(--space-4); color: var(--text-secondary); }
.command-center__steps { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
.command-center__steps li { gap: var(--space-2); min-height: 28px; color: var(--text-secondary); }
.command-center__steps li.is-running, .command-center__steps li.is-waiting_approval { color: var(--text-primary); }
.command-center__steps li.is-failed { color: var(--color-error); }
.step-dot { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid currentColor; border-radius: 50%; }
.is-running .step-dot { background: var(--accent-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 14%, transparent); }
.step-copy { display: grid; flex: 1; font-size: var(--text-xs); }
.step-copy small { opacity: .8; }
.step-retry, .command-reject, .command-secondary, .command-primary, .command-icon-btn, .command-expand { border: 0; border-radius: var(--radius-sm); cursor: pointer; }
.step-retry, .command-reject, .command-secondary { color: var(--text-secondary); background: var(--surface-hover); }
.step-retry { padding: 4px 8px; }
.command-center__commands { display: grid; gap: var(--space-2); }
.command-item { border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-primary); overflow: hidden; }
.command-item.is-rejected { opacity: .55; }
.command-item__summary { gap: var(--space-2); padding: var(--space-2); }
.command-expand, .command-icon-btn { display: grid; place-items: center; width: 26px; height: 26px; color: var(--text-tertiary); background: transparent; }
.command-expand svg { transition: transform .15s ease; }
.command-expand svg.collapsed { transform: rotate(-90deg); }
.command-item__title { display: grid; flex: 1; min-width: 0; }
.command-item__title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-sm); }
.command-item__title small { color: var(--text-tertiary); }
.command-reject, .command-secondary, .command-primary { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; font-size: var(--text-xs); }
.command-edit-input { width: calc(100% - var(--space-4)); margin: 0 var(--space-2) var(--space-2); padding: var(--space-2); border: 1px solid var(--accent-primary); border-radius: var(--radius-sm); color: var(--text-primary); background: var(--surface-secondary); }
.command-item__details { padding: var(--space-2) var(--space-3); border-top: 1px solid var(--border-subtle); }
.command-diff { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.command-diff > div { padding: var(--space-2); border-radius: var(--radius-sm); background: var(--surface-secondary); }
.command-diff span, .command-identity { color: var(--text-tertiary); font-size: var(--text-xs); }
.command-diff p { margin: 3px 0 0; overflow-wrap: anywhere; font-size: var(--text-xs); }
.command-identity { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
.command-approval { gap: var(--space-2); color: var(--color-warning); font-size: var(--text-xs); }
.command-error { margin: 0; color: var(--color-error); font-size: var(--text-xs); }
.command-history { padding: var(--space-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: var(--text-xs); }
.command-history summary { cursor: pointer; color: var(--text-secondary); font-weight: var(--font-semibold); }
.command-history__item { display: flex; align-items: center; gap: var(--space-2); padding-top: var(--space-2); }
.command-history__item > span { display: grid; flex: 1; }
.command-history__item small { color: var(--text-tertiary); }
.command-history__unavailable { white-space: nowrap; }
.command-center__footer { justify-content: flex-end; gap: var(--space-2); color: var(--text-tertiary); font-size: var(--text-xs); }
.command-center__footer > span { margin-inline-end: auto; }
.command-primary { color: white; background: var(--accent-primary); }
.command-primary:disabled { cursor: not-allowed; opacity: .5; }

@media (max-width: 560px) {
  .command-diff { grid-template-columns: 1fr; }
  .command-reject { font-size: 0; }
}
</style>
