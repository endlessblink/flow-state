<template>
  <section class="form-section collapsible">
    <div class="section-toggle-wrapper">
      <button class="section-toggle" type="button" @click="toggleExpanded">
        <component
          :is="ChevronDown"
          :size="16"
          class="chevron-icon"
          :class="{ rotated: !isExpanded }"
        />
        Comments
        <BaseBadge variant="count">{{ comments.length }}</BaseBadge>
      </button>
    </div>

    <div v-show="isExpanded" class="section-content">
      <!-- Loading state -->
      <div v-if="isLoading" class="comments-loading">Loading...</div>

      <!-- Comment list -->
      <div v-else class="comments-list">
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="comment-item"
          @mouseenter="hoveredId = comment.id"
          @mouseleave="hoveredId = null"
        >
          <!-- Avatar: initials circle -->
          <div class="comment-avatar" :style="{ background: avatarColor(comment.userId) }">
            {{ getInitials(comment) }}
          </div>

          <!-- Content -->
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">{{ comment.userName || comment.userEmail || 'Unknown' }}</span>
              <span class="comment-time">{{ relativeTime(comment.createdAt) }}</span>
              <span v-if="wasEdited(comment)" class="comment-edited">(edited)</span>
              <!-- Action buttons on hover, own comments only -->
              <div v-if="isOwnComment(comment) && hoveredId === comment.id" class="comment-actions">
                <button class="comment-action-btn" type="button" @click="startEditing(comment)">
                  <Pencil :size="12" />
                </button>
                <button class="comment-action-btn comment-action-delete" type="button" @click="handleDelete(comment.id)">
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>

            <!-- Display or edit mode -->
            <p v-if="editingCommentId !== comment.id" class="comment-text">{{ comment.content }}</p>
            <div v-else class="comment-edit-row">
              <input
                v-model="editContent"
                class="comment-edit-input"
                @keydown.enter.exact.prevent="saveEdit"
                @keydown.escape="cancelEdit"
              />
              <button class="comment-save-btn" type="button" @click="saveEdit">Save</button>
              <button class="comment-cancel-btn" type="button" @click="cancelEdit">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <p v-if="!comments.length && !isLoading" class="comments-empty">No comments yet</p>
      </div>

      <!-- Input row -->
      <div class="comment-input-row">
        <input
          v-model="newComment"
          class="comment-input"
          placeholder="Add a comment..."
          @keydown.enter.exact.prevent="sendComment"
        />
        <button
          class="comment-send-btn"
          type="button"
          :disabled="!newComment.trim()"
          @click="sendComment"
        >
          <Send :size="14" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Send, Pencil, Trash2 } from 'lucide-vue-next'
import { useTaskComments } from '@/composables/supabase/useTaskComments'
import { useAuthStore } from '@/stores/auth'
import BaseBadge from '@/components/base/BaseBadge.vue'
import type { TaskComment } from '@/types/workspace'

// ─── Props ────────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  taskId: string
  workspaceId: string
  defaultExpanded?: boolean
}>(), {
  defaultExpanded: false,
})

// ─── Composable ───────────────────────────────────────────────────────────────

const {
  comments,
  isLoading,
  fetchComments,
  addComment,
  updateComment,
  deleteComment,
  subscribeToComments,
} = useTaskComments()

// ─── Auth ─────────────────────────────────────────────────────────────────────

const authStore = useAuthStore()

// ─── UI state ─────────────────────────────────────────────────────────────────

const isExpanded = ref(props.defaultExpanded)
const newComment = ref('')
const editingCommentId = ref<string | null>(null)
const editContent = ref('')
const hoveredId = ref<string | null>(null)

// ─── Subscription management ──────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null

function setupSubscription(taskId: string): void {
  if (unsubscribe) unsubscribe()
  unsubscribe = subscribeToComments(taskId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
}

function isOwnComment(comment: TaskComment): boolean {
  return comment.userId === authStore.user?.id
}

function wasEdited(comment: TaskComment): boolean {
  return comment.updatedAt.getTime() - comment.createdAt.getTime() > 1000
}

function getInitials(comment: TaskComment): string {
  if (comment.userName) {
    const parts = comment.userName.split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : comment.userName.substring(0, 2).toUpperCase()
  }
  if (comment.userEmail) return comment.userEmail[0].toUpperCase()
  return '?'
}

function avatarColor(userId: string): string {
  const colors = [
    'var(--brand-primary)',
    'var(--color-priority-high)',
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function relativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function sendComment(): Promise<void> {
  const text = newComment.value.trim()
  if (!text) return
  newComment.value = ''
  await addComment(props.taskId, text, null, props.workspaceId)
}

function startEditing(comment: TaskComment): void {
  editingCommentId.value = comment.id
  editContent.value = comment.content
}

async function saveEdit(): Promise<void> {
  if (!editingCommentId.value || !editContent.value.trim()) return
  await updateComment(editingCommentId.value, editContent.value.trim())
  editingCommentId.value = null
  editContent.value = ''
}

function cancelEdit(): void {
  editingCommentId.value = null
  editContent.value = ''
}

async function handleDelete(commentId: string): Promise<void> {
  await deleteComment(commentId)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  const fetched = await fetchComments(props.taskId)
  if (!props.defaultExpanded && fetched.length > 0) isExpanded.value = true
  setupSubscription(props.taskId)
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

watch(
  () => props.taskId,
  async (newId, oldId) => {
    if (newId !== oldId) {
      if (unsubscribe) unsubscribe()
      const fetched = await fetchComments(newId)
      isExpanded.value = props.defaultExpanded || fetched.length > 0
      setupSubscription(newId)
    }
  }
)
</script>

<style scoped>
/* ─── Section shell ─────────────────────────────────────────────────────────── */

.collapsible {
  margin-bottom: var(--space-4);
}

.section-toggle-wrapper {
  display: flex;
  align-items: center;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-toggle:hover {
  color: var(--text-secondary);
}

.chevron-icon {
  transition: transform var(--duration-fast);
  color: var(--text-muted);
  flex-shrink: 0;
}

.chevron-icon.rotated {
  transform: rotate(-90deg);
}

.section-content {
  animation: slideDown var(--duration-normal);
  padding-inline-start: var(--space-2);
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 1000px; }
}

/* ─── Loading ────────────────────────────────────────────────────────────────── */

.comments-loading {
  color: var(--text-muted);
  font-size: var(--text-xs);
  padding: var(--space-3) 0;
}

/* ─── Comment list ───────────────────────────────────────────────────────────── */

.comments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
  margin-bottom: var(--space-3);
}

.comment-item {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

/* ─── Avatar ─────────────────────────────────────────────────────────────────── */

.comment-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: white;
  user-select: none;
}

/* ─── Comment body ───────────────────────────────────────────────────────────── */

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  flex-wrap: wrap;
  margin-bottom: var(--space-1);
}

.comment-author {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.comment-time {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.comment-edited {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-style: italic;
}

.comment-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
}

/* ─── Inline edit ────────────────────────────────────────────────────────────── */

.comment-edit-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.comment-edit-input {
  flex: 1;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  min-width: 0;
}

.comment-edit-input:focus {
  border-color: var(--brand-primary-dim);
}

.comment-save-btn,
.comment-cancel-btn {
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.comment-save-btn {
  color: var(--brand-primary);
  border-color: var(--brand-primary-dim);
}

.comment-save-btn:hover {
  background: var(--brand-primary-subtle);
}

.comment-cancel-btn {
  color: var(--text-muted);
}

.comment-cancel-btn:hover {
  color: var(--text-secondary);
  background: var(--glass-bg-soft);
}

/* ─── Hover actions ──────────────────────────────────────────────────────────── */

.comment-actions {
  display: flex;
  gap: var(--space-1);
  margin-inline-start: auto;
}

.comment-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: color var(--duration-fast), background var(--duration-fast);
}

.comment-action-btn:hover {
  color: var(--text-secondary);
  background: var(--glass-bg-soft);
}

.comment-action-delete:hover {
  color: var(--color-priority-high);
  background: transparent;
}

/* ─── Empty state ────────────────────────────────────────────────────────────── */

.comments-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-align: center;
  padding: var(--space-4) 0;
}

/* ─── Input row ──────────────────────────────────────────────────────────────── */

.comment-input-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-2);
}

.comment-input {
  flex: 1;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  min-width: 0;
  transition: border-color var(--duration-fast);
}

.comment-input::placeholder {
  color: var(--text-muted);
}

.comment-input:focus {
  border-color: var(--brand-primary-dim);
}

.comment-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: var(--space-2);
  cursor: pointer;
  color: var(--brand-primary);
  border-radius: var(--radius-md);
  transition: color var(--duration-fast), background var(--duration-fast);
  flex-shrink: 0;
}

.comment-send-btn:hover:not(:disabled) {
  background: var(--brand-primary-subtle);
}

.comment-send-btn:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
