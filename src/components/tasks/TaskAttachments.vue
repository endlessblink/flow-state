<template>
  <section class="attachments-section">
    <h3 class="section-title">Attachments</h3>

    <!-- Drag-drop zone -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone--active': isDragOver, 'drop-zone--disabled': !isGoogleConnected }"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="openFilePicker"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        class="file-input-hidden"
        @change="handleFileSelect"
      />
      <div v-if="uploadStatus" class="upload-progress">
        <div class="upload-progress-bar" :style="{ width: `${uploadProgress}%` }" />
        <span class="upload-progress-text">{{ uploadStatusText }}</span>
      </div>
      <div v-else class="drop-zone-content">
        <ImagePlus :size="20" class="drop-zone-icon" />
        <span class="drop-zone-text">
          {{ isGoogleConnected ? 'Drop images here, click to browse, or paste from clipboard' : 'Connect Google account to attach images' }}
        </span>
      </div>
    </div>

    <!-- Error message -->
    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <!-- Thumbnail grid -->
    <div v-if="attachments.length > 0" class="thumbnail-grid">
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="thumbnail-item"
      >
        <img
          v-if="!failedThumbnails.has(attachment.id)"
          :src="getThumbnailSrc(attachment)"
          :alt="attachment.name"
          class="thumbnail-img"
          loading="lazy"
          @click="openInDrive(attachment)"
          @error="handleThumbnailError(attachment)"
        />
        <div
          v-else
          class="thumbnail-fallback"
          @click="openInDrive(attachment)"
        >
          <ImagePlus :size="24" />
        </div>
        <button
          class="thumbnail-delete"
          :title="`Remove ${attachment.name}`"
          @click.stop="confirmDelete(attachment)"
        >
          <X :size="12" />
        </button>
        <span class="thumbnail-name">{{ attachment.name }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ImagePlus, X } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { uploadImage, deleteImage, getThumbnailUrl, type UploadProgress } from '@/services/drive/googleDriveService'
import type { TaskAttachment } from '@/types/tasks'
import { openExternal } from '@/utils/openExternal'

const props = defineProps<{
  attachments: TaskAttachment[]
}>()

const emit = defineEmits<{
  (e: 'add', attachment: TaskAttachment): void
  (e: 'remove', attachmentId: string): void
}>()

const settingsStore = useSettingsStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const uploadStatus = ref<UploadProgress['status'] | null>(null)
const uploadProgress = ref(0)
const errorMessage = ref<string | null>(null)

const isGoogleConnected = computed(() => settingsStore.googleConnected)
const failedThumbnails = ref<Set<string>>(new Set())

function handleThumbnailError(attachment: TaskAttachment) {
  failedThumbnails.value = new Set([...failedThumbnails.value, attachment.id])
}

const uploadStatusText = computed(() => {
  switch (uploadStatus.value) {
    case 'compressing': return 'Compressing...'
    case 'uploading': return 'Uploading...'
    case 'done': return 'Done!'
    default: return ''
  }
})

function getThumbnailSrc(attachment: TaskAttachment): string {
  return attachment.thumbnailUrl || getThumbnailUrl(attachment.driveFileId)
}

function openInDrive(attachment: TaskAttachment) {
  const url = `https://drive.google.com/file/d/${attachment.driveFileId}/view`
  openExternal(url)
}

function openFilePicker() {
  if (!isGoogleConnected.value) return
  fileInputRef.value?.click()
}

function handleDragOver(e: DragEvent) {
  if (!isGoogleConnected.value) return
  e.dataTransfer!.dropEffect = 'copy'
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

async function handleDrop(e: DragEvent) {
  isDragOver.value = false
  if (!isGoogleConnected.value) return
  const files = Array.from(e.dataTransfer?.files || [])
  const imageFiles = files.filter(f => f.type.startsWith('image/'))
  for (const file of imageFiles) {
    await processUpload(file)
  }
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  for (const file of files) {
    await processUpload(file)
  }
  // Reset input so same file can be selected again
  input.value = ''
}

async function processUpload(file: File) {
  errorMessage.value = null
  // TASK-1441: File uploads require network access — show informative message offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    errorMessage.value = 'File uploads require an internet connection. Please check your network and try again.'
    return
  }
  const googleToken = settingsStore.googleProviderToken
  const googleRefreshToken = settingsStore.googleProviderRefreshToken || undefined

  if (!googleToken) {
    errorMessage.value = 'Google token expired — please reconnect in Settings'
    return
  }

  try {
    const result = await uploadImage(
      file,
      googleToken,
      googleRefreshToken,
      (progress) => {
        uploadStatus.value = progress.status
        uploadProgress.value = progress.progress
      }
    )

    // Update token if refreshed
    if (result.newAccessToken) {
      settingsStore.updateSetting('googleProviderToken', result.newAccessToken)
      settingsStore.updateSetting('googleProviderTokenExpiry', Date.now() + 3500 * 1000)
    }

    emit('add', result.attachment as TaskAttachment)
  } catch (e: unknown) {
    errorMessage.value = (e as Error).message
  } finally {
    // Clear progress after short delay
    setTimeout(() => {
      uploadStatus.value = null
      uploadProgress.value = 0
    }, 1500)
  }
}

// FEATURE-1414: Clipboard paste support for images
function handlePaste(e: ClipboardEvent) {
  if (!isGoogleConnected.value) return

  const items = e.clipboardData?.items
  if (!items) return

  const imageFiles: File[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) imageFiles.push(file)
    }
  }

  if (imageFiles.length === 0) return

  // Prevent the paste from also inserting into text fields
  e.preventDefault()

  for (const file of imageFiles) {
    processUpload(file)
  }
}

onMounted(() => {
  document.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
})

async function confirmDelete(attachment: TaskAttachment) {
  if (!confirm(`Remove "${attachment.name}"? This will also delete it from Google Drive.`)) return

  errorMessage.value = null
  // TASK-1441: Drive deletion requires network access — show informative message offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    errorMessage.value = 'Deleting Drive files requires an internet connection. Please check your network and try again.'
    return
  }
  const googleToken = settingsStore.googleProviderToken
  const googleRefreshToken = settingsStore.googleProviderRefreshToken || undefined

  if (!googleToken) {
    errorMessage.value = 'Google token expired — please reconnect in Settings'
    return
  }

  try {
    const result = await deleteImage(attachment.driveFileId, googleToken, googleRefreshToken)
    if (result.newAccessToken) {
      settingsStore.updateSetting('googleProviderToken', result.newAccessToken)
      settingsStore.updateSetting('googleProviderTokenExpiry', Date.now() + 3500 * 1000)
    }
    emit('remove', attachment.id)
  } catch (e: unknown) {
    errorMessage.value = (e as Error).message
  }
}
</script>

<style scoped>
.attachments-section {
  margin-top: var(--space-4);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  margin: 0 0 var(--space-3) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.drop-zone {
  border: 2px dashed var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  text-align: center;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  background: var(--glass-bg-soft);
}

.drop-zone:hover:not(.drop-zone--disabled) {
  border-color: var(--brand-primary);
  background: var(--brand-primary-bg-subtle);
}

.drop-zone--active {
  border-color: var(--brand-primary);
  background: var(--brand-primary-bg-subtle);
  transform: scale(1.01);
}

.drop-zone--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drop-zone-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.drop-zone-icon {
  color: var(--text-muted);
}

.drop-zone-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.file-input-hidden {
  display: none;
}

.upload-progress {
  position: relative;
  height: 24px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--glass-bg-soft);
}

.upload-progress-bar {
  position: absolute;
  inset: 0;
  background: var(--brand-primary);
  opacity: 0.2;
  transition: width 0.3s ease;
}

.upload-progress-text {
  position: relative;
  z-index: 1;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 24px;
}

.error-text {
  font-size: var(--text-xs);
  color: var(--color-priority-high);
  margin: var(--space-2) 0 0;
}

.thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.thumbnail-item {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.thumbnail-item:hover {
  border-color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--shadow-color-soft);
}

.thumbnail-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.thumbnail-delete {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  background: var(--overlay-component-bg);
  backdrop-filter: blur(4px);
  border: 1px solid var(--glass-border);
  color: var(--color-priority-high);
  border-radius: var(--radius-full);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast);
  padding: 0;
}

.thumbnail-item:hover .thumbnail-delete {
  opacity: 1;
}

.thumbnail-delete:hover {
  background: var(--danger-bg-subtle);
  border-color: var(--color-priority-high);
}

.thumbnail-fallback {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-soft);
  color: var(--text-muted);
  cursor: pointer;
}

.thumbnail-name {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  padding: 2px var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
