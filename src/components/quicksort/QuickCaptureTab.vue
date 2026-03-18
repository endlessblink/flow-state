<template>
  <div class="quick-capture-tab">
    <!-- Task Input Form -->
    <div class="capture-form">
      <!-- Title Input -->
      <div class="input-group title-group">
        <div class="title-input-row">
          <input
            ref="titleInputRef"
            v-model="newTask.title"
            type="text"
            name="quick-capture-title"
            class="capture-input title-input"
            :class="{ 'voice-active': isListening }"
            :placeholder="isListening ? 'Listening...' : 'What needs to be done?'"
            maxlength="200"
            dir="auto"
            @keydown="handleTitleKeydown"
            @paste="handlePaste"
          >
          <!-- Mic button (TASK-1024) - ALWAYS SHOW FOR DEBUG -->
          <button
            class="mic-btn"
            :class="[{ recording: isListening }]"
            :aria-label="isListening ? 'Stop recording' : 'Voice input'"
            @click="toggleVoiceInput"
          >
            <Mic v-if="!isListening" :size="18" />
            <MicOff v-else :size="18" />
          </button>
        </div>
        <span v-if="newTask.title.length > 0" class="char-count" :class="{ 'near-limit': newTask.title.length > 170 }">{{ newTask.title.length }}/200</span>
        <!-- Voice feedback (when recording) -->
        <div v-if="isListening" class="voice-feedback">
          <div class="voice-waveform">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
          <span class="voice-status">{{ displayTranscript || 'Speak now...' }}</span>
          <button class="voice-cancel" aria-label="Cancel voice input" @click="cancelVoice">
            <X :size="14" />
          </button>
        </div>
        <!-- Voice error message -->
        <div v-if="voiceError && !isListening" class="voice-error">
          {{ voiceError }}
        </div>
        <!-- TASK-1325: URL scraping feedback -->
        <div v-if="isScraping" class="url-scraping-feedback">
          <Globe :size="16" class="scraping-icon" />
          <span class="scraping-status">Fetching page info...</span>
          <button class="scraping-cancel" aria-label="Cancel URL scraping" @click="cancelScraping">
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Description Input -->
      <div class="input-group description-group">
        <textarea
          v-model="newTask.description"
          name="quick-capture-description"
          class="capture-input description-input"
          placeholder="Notes (optional)..."
          rows="1"
          maxlength="2000"
          dir="auto"
          @keydown="handleDescriptionKeydown"
        />
      </div>

      <!-- Priority & Due Date Row -->
      <div class="metadata-row">
        <!-- Priority -->
        <div class="metadata-group">
          <label class="metadata-label">Priority:</label>
          <div class="priority-buttons">
            <button
              class="priority-btn"
              :class="{ active: newTask.priority === undefined }"
              @click="newTask.priority = undefined"
            >
              None
            </button>
            <button
              class="priority-btn low"
              :class="{ active: newTask.priority === 'low' }"
              @click="newTask.priority = 'low'"
            >
              Low
            </button>
            <button
              class="priority-btn medium"
              :class="{ active: newTask.priority === 'medium' }"
              @click="newTask.priority = 'medium'"
            >
              Med
            </button>
            <button
              class="priority-btn high"
              :class="{ active: newTask.priority === 'high' }"
              @click="newTask.priority = 'high'"
            >
              High
            </button>
          </div>
        </div>

        <!-- Due Date -->
        <div class="metadata-group">
          <label class="metadata-label">Due:</label>
          <div class="date-shortcuts">
            <button
              class="date-btn"
              :class="{ active: isDueDateToday }"
              @click="setDueDate('today')"
            >
              Today
            </button>
            <button
              class="date-btn"
              :class="{ active: isDueDateTomorrow }"
              @click="setDueDate('tomorrow')"
            >
              +1
            </button>
            <button
              class="date-btn"
              @click="setDueDate('in3days')"
            >
              +3
            </button>
            <button
              class="date-btn"
              :class="{ active: isDueDateWeekend }"
              @click="setDueDate('weekend')"
            >
              Wknd
            </button>
            <button
              class="date-btn"
              @click="setDueDate('nextweek')"
            >
              +7
            </button>
            <button
              class="date-btn"
              @click="setDueDate('in2weeks')"
            >
              +14
            </button>
            <button
              class="date-btn"
              @click="setDueDate('in30days')"
            >
              +30
            </button>
            <NPopover trigger="click" placement="bottom" :show-arrow="false">
              <template #trigger>
                <button
                  class="date-btn date-picker-trigger"
                  :class="{ active: newTask.dueDate && !isDueDateToday && !isDueDateTomorrow && !isDueDateWeekend }"
                >
                  <Calendar :size="14" />
                </button>
              </template>
              <div @click.stop>
                <NDatePicker
                  panel
                  :value="newTask.dueDate ? new Date(newTask.dueDate + 'T00:00:00').getTime() : null"
                  type="date"
                  :actions="[]"
                  @update:value="handleDatePickerUpdate"
                />
              </div>
            </NPopover>
            <button
              v-if="newTask.dueDate"
              class="date-btn clear"
              @click="newTask.dueDate = undefined"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Project Selection -->
      <div class="metadata-group project-group">
        <label class="metadata-label">Project:</label>
        <div class="project-pills">
          <button
            v-for="project in topProjects"
            :key="project.id"
            class="project-pill"
            :class="{ active: newTask.projectId === project.id }"
            @click="newTask.projectId = newTask.projectId === project.id ? undefined : project.id"
          >
            <ProjectEmojiIcon
              v-if="project.colorType === 'emoji' && project.emoji"
              :emoji="project.emoji"
              size="xs"
            />
            <span v-else class="project-dot" :style="{ background: Array.isArray(project.color) ? project.color[0] : project.color }" />
            {{ project.name }}
          </button>
          <button
            v-if="newTask.projectId"
            class="project-pill clear"
            @click="newTask.projectId = undefined"
          >
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Duration Estimate -->
      <div class="metadata-group">
        <label class="metadata-label">Estimate:</label>
        <div class="duration-buttons">
          <button
            class="duration-btn"
            :class="{ active: !newTask.estimatedDuration }"
            @click="newTask.estimatedDuration = undefined"
          >
            None
          </button>
          <button
            class="duration-btn quick"
            :class="{ active: newTask.estimatedDuration === 15 }"
            @click="newTask.estimatedDuration = 15"
          >
            <Zap :size="12" /> Quick
          </button>
          <button
            class="duration-btn short"
            :class="{ active: newTask.estimatedDuration === 30 }"
            @click="newTask.estimatedDuration = 30"
          >
            <Coffee :size="12" /> Short
          </button>
          <button
            class="duration-btn medium"
            :class="{ active: newTask.estimatedDuration === 60 }"
            @click="newTask.estimatedDuration = 60"
          >
            <Hourglass :size="12" /> Med
          </button>
          <button
            class="duration-btn long"
            :class="{ active: newTask.estimatedDuration === 120 }"
            @click="newTask.estimatedDuration = 120"
          >
            <Mountain :size="12" /> Long
          </button>
        </div>
      </div>

      <!-- Success confirmation -->
      <Transition name="confirm-fade">
        <div v-if="lastAdded" class="add-confirmation">
          <Check :size="14" />
          <span class="confirm-text">
            <strong>{{ lastAdded.title }}</strong>
            <template v-if="lastAdded.project"> → {{ lastAdded.project }}</template>
            <template v-else> → Sort queue</template>
          </span>
        </div>
      </Transition>

      <!-- Add Task Button -->
      <div class="action-row">
        <span v-if="canAddTask" class="task-destination">
          <template v-if="newTask.projectId">
            <Check :size="12" />
            Sorted → {{ getProjectName(newTask.projectId) }}
          </template>
          <template v-else>
            Will appear in Sort queue
          </template>
        </span>
        <button
          class="capture-add-btn"
          :disabled="!canAddTask"
          @click="handleAddTask"
        >
          <Plus :size="16" />
          <span>Add Task</span>
          <kbd class="capture-kbd">Enter</kbd>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, reactive } from 'vue'
import { NPopover, NDatePicker } from 'naive-ui'
import { X, Plus, Calendar, Mic, MicOff, Globe, Check, Zap, Coffee, Hourglass, Mountain } from 'lucide-vue-next'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'
import { useUrlScraping } from '@/composables/useUrlScraping'
import { useTaskStore } from '@/stores/tasks'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const taskStore = useTaskStore()

// Show first 7 projects for quick selection
const topProjects = computed(() => taskStore.projects.slice(0, 7))

// Template refs
const titleInputRef = ref<HTMLInputElement>()

// TASK-1322: Whisper-only voice input (browser speech recognition removed)
const {
  isRecording: isListening,
  isProcessing: _isProcessingVoice,
  isSupported: isWhisperSupported,
  hasApiKey: hasWhisperApiKey,
  transcript: whisperTranscript,
  error: voiceError,
  start: startVoice,
  stop: stopVoice,
  cancel: cancelVoice
} = useWhisperSpeech({
  onResult: (result) => {
    if (result.transcript.trim()) {
      newTask.title = result.transcript.trim()
    }
  },
  onError: (err) => {
    console.warn('[Voice QuickCapture] Error:', err)
  }
})

const _isVoiceSupported = computed(() => isWhisperSupported.value && hasWhisperApiKey.value)
const displayTranscript = computed(() => whisperTranscript.value)

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    stopVoice()
  } else {
    newTask.title = ''
    await startVoice()
  }
}

// TASK-1325: URL scraping on paste
const { isScraping, scrapeIfUrl, cancel: cancelScraping } = useUrlScraping()

const handlePaste = async (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData('text') || ''
  if (!text.trim()) return

  const result = await scrapeIfUrl(text)
  if (result) {
    newTask.title = result.title
    newTask.description = result.description
  }
}

// Form state
const newTask = reactive<{
  title: string
  description: string | undefined
  priority: 'low' | 'medium' | 'high' | undefined
  dueDate: string | undefined
  projectId: string | undefined
  estimatedDuration: number | undefined
}>({
  title: '',
  description: undefined,
  priority: undefined,
  dueDate: undefined,
  projectId: undefined,
  estimatedDuration: undefined
})

// Success confirmation
const lastAdded = ref<{ title: string; project: string | null } | null>(null)
let confirmTimeout: ReturnType<typeof setTimeout> | undefined

// Computed
const canAddTask = computed(() => newTask.title.trim().length > 0)

const isDueDateToday = computed(() => {
  if (!newTask.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(newTask.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return today.getTime() === dueDate.getTime()
})

const isDueDateTomorrow = computed(() => {
  if (!newTask.dueDate) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const dueDate = new Date(newTask.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return tomorrow.getTime() === dueDate.getTime()
})

const isDueDateWeekend = computed(() => {
  if (!newTask.dueDate) return false
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
  const saturday = new Date()
  saturday.setDate(today.getDate() + daysUntilSaturday)
  saturday.setHours(0, 0, 0, 0)
  const dueDate = new Date(newTask.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return saturday.getTime() === dueDate.getTime()
})

// Flying animation — WAAPI-powered arc with lift-off, particle trail, and landing burst
function flyTaskToProject(title: string, projectId: string | undefined) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const originEl = titleInputRef.value
  if (!originEl) return
  const originRect = originEl.getBoundingClientRect()

  // Find target
  let targetEl: Element | null = null
  if (projectId) {
    targetEl = document.querySelector(`[data-drop-project-id="${projectId}"]`)
  }
  if (!targetEl) {
    targetEl = document.querySelector('.projects-list') || document.querySelector('.sidebar')
  }
  if (!targetEl) return
  const targetRect = targetEl.getBoundingClientRect()
  if (targetRect.top < 0 || targetRect.bottom > window.innerHeight) return

  const ox = originRect.left + originRect.width / 2
  const oy = originRect.top + originRect.height / 2
  const tx = targetRect.left + targetRect.width / 2
  const ty = targetRect.top + targetRect.height / 2
  const dx = tx - ox
  const dy = ty - oy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Arc peak: lift upward proportional to distance, capped
  const arcPeak = -Math.min(dist * 0.35, 120)

  // --- Main ghost element ---
  const ghost = document.createElement('div')
  ghost.textContent = title.length > 28 ? title.slice(0, 28) + '…' : title
  ghost.setAttribute('dir', 'auto')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${originRect.left}px`,
    top: `${originRect.top}px`,
    width: `${originRect.width}px`,
    height: `${originRect.height}px`,
    padding: '8px 16px',
    background: 'rgba(78, 205, 196, 0.18)',
    border: '1px solid rgba(78, 205, 196, 0.5)',
    borderRadius: '10px',
    color: '#4ECDC4',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    zIndex: '10000',
    pointerEvents: 'none',
    backdropFilter: 'blur(12px)',
    willChange: 'transform, opacity',
  })
  document.body.appendChild(ghost)

  // Phase 1: Lift-off (scale up + glow intensifies + slight float up)
  const liftOff = ghost.animate([
    {
      transform: 'translateY(0) scale(1) rotate(0deg)',
      boxShadow: '0 4px 16px rgba(78, 205, 196, 0.3)',
      opacity: 1,
    },
    {
      transform: 'translateY(-8px) scale(1.05) rotate(-1deg)',
      boxShadow: '0 12px 40px rgba(78, 205, 196, 0.5), 0 0 20px rgba(78, 205, 196, 0.3)',
      opacity: 1,
    },
  ], {
    duration: 150,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // overshoot
    fill: 'forwards',
  })

  liftOff.onfinish = () => {
    // Phase 2: Arc flight with WAAPI keyframes
    // Compute intermediate arc points for a smooth parabolic path
    const midX = dx * 0.5
    const midY = dy * 0.5 + arcPeak // peak of arc is above midpoint
    const q1X = dx * 0.25
    const q1Y = dy * 0.25 + arcPeak * 0.8
    const q3X = dx * 0.75
    const q3Y = dy * 0.75 + arcPeak * 0.5

    const flight = ghost.animate([
      {
        transform: 'translateY(-8px) scale(1.05) rotate(-1deg)',
        boxShadow: '0 12px 40px rgba(78, 205, 196, 0.5), 0 0 20px rgba(78, 205, 196, 0.3)',
        width: `${originRect.width}px`,
        height: `${originRect.height}px`,
        borderRadius: '10px',
        fontSize: '14px',
        padding: '8px 16px',
        opacity: 1,
        offset: 0,
      },
      {
        transform: `translate(${q1X}px, ${q1Y}px) scale(0.9) rotate(-3deg)`,
        boxShadow: '0 16px 48px rgba(78, 205, 196, 0.6), 0 0 30px rgba(78, 205, 196, 0.4)',
        width: `${originRect.width * 0.85}px`,
        height: `${originRect.height * 0.9}px`,
        borderRadius: '10px',
        fontSize: '13px',
        padding: '6px 14px',
        opacity: 1,
        offset: 0.25,
      },
      {
        transform: `translate(${midX}px, ${midY}px) scale(0.7) rotate(-2deg)`,
        boxShadow: '0 20px 60px rgba(78, 205, 196, 0.7), 0 0 40px rgba(78, 205, 196, 0.5)',
        width: `${originRect.width * 0.6}px`,
        height: `${originRect.height * 0.8}px`,
        borderRadius: '12px',
        fontSize: '11px',
        padding: '5px 10px',
        opacity: 0.95,
        offset: 0.5,
      },
      {
        transform: `translate(${q3X}px, ${q3Y}px) scale(0.45) rotate(0deg)`,
        boxShadow: '0 10px 32px rgba(78, 205, 196, 0.5), 0 0 24px rgba(78, 205, 196, 0.3)',
        width: '80px',
        height: '28px',
        borderRadius: '14px',
        fontSize: '6px',
        padding: '4px 6px',
        opacity: 0.8,
        offset: 0.75,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(2deg)`,
        boxShadow: '0 0 0 rgba(78, 205, 196, 0), 0 0 0 rgba(78, 205, 196, 0)',
        width: '40px',
        height: '20px',
        borderRadius: '10px',
        fontSize: '0px',
        padding: '2px',
        opacity: 0,
        offset: 1,
      },
    ], {
      duration: 500,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)', // smooth decel
      fill: 'forwards',
    })

    // Spawn particle trail during flight
    spawnTrailParticles(ox, oy, dx, dy, arcPeak)

    flight.onfinish = () => {
      ghost.remove()
      // Landing burst at target
      spawnLandingBurst(tx, ty)
    }
  }

  // Flash sidebar target
  if (projectId) {
    const sidebarTarget = document.querySelector(`[data-drop-project-id="${projectId}"]`)
    if (sidebarTarget) {
      setTimeout(() => {
        sidebarTarget.classList.add('task-landed')
        setTimeout(() => sidebarTarget.classList.remove('task-landed'), 1000)
      }, 600) // time to match flight end
    }
  }

  // Safety cleanup
  setTimeout(() => { if (ghost.parentNode) ghost.remove() }, 1200)
}

// Spawn small glowing particles along the flight arc
function spawnTrailParticles(ox: number, oy: number, dx: number, dy: number, arcPeak: number) {
  const count = 6
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const t = (i + 1) / (count + 1) // progress along path (0..1)
      // Parabolic arc position: quadratic bezier with peak
      const x = ox + dx * t
      const y = oy + dy * t + arcPeak * 4 * t * (1 - t) // parabola

      const particle = document.createElement('div')
      Object.assign(particle.style, {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#4ECDC4',
        boxShadow: '0 0 8px 2px rgba(78, 205, 196, 0.6)',
        zIndex: '9999',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
      })
      document.body.appendChild(particle)

      // Particle fades and drifts
      particle.animate([
        { transform: 'scale(1)', opacity: 0.8 },
        { transform: `scale(0) translateY(${10 + Math.random() * 15}px)`, opacity: 0 },
      ], {
        duration: 400 + Math.random() * 200,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      }).onfinish = () => particle.remove()
    }, i * 70) // staggered spawn
  }
}

// Burst of particles at the landing point
function spawnLandingBurst(cx: number, cy: number) {
  const count = 8
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
    const distance = 18 + Math.random() * 22
    const endX = Math.cos(angle) * distance
    const endY = Math.sin(angle) * distance
    const size = 3 + Math.random() * 4

    const dot = document.createElement('div')
    Object.assign(dot.style, {
      position: 'fixed',
      left: `${cx - size / 2}px`,
      top: `${cy - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: '#4ECDC4',
      boxShadow: '0 0 6px 1px rgba(78, 205, 196, 0.7)',
      zIndex: '10001',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
    })
    document.body.appendChild(dot)

    dot.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${endX}px, ${endY}px) scale(0)`, opacity: 0 },
    ], {
      duration: 350 + Math.random() * 150,
      easing: 'cubic-bezier(0, 0.8, 0.5, 1)',
      fill: 'forwards',
    }).onfinish = () => dot.remove()
  }

  // Central flash ring
  const ring = document.createElement('div')
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${cx - 15}px`,
    top: `${cy - 15}px`,
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '2px solid rgba(78, 205, 196, 0.8)',
    background: 'rgba(78, 205, 196, 0.15)',
    zIndex: '10001',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  })
  document.body.appendChild(ring)

  ring.animate([
    { transform: 'scale(0.3)', opacity: 1 },
    { transform: 'scale(2.5)', opacity: 0 },
  ], {
    duration: 400,
    easing: 'cubic-bezier(0, 0.55, 0.45, 1)',
    fill: 'forwards',
  }).onfinish = () => ring.remove()
}

// Actions
async function handleAddTask() {
  if (!canAddTask.value) return

  const savedTitle = newTask.title.trim()
  const savedProjectId = newTask.projectId
  const savedProject = savedProjectId ? getProjectName(savedProjectId) : null

  // Trigger flying animation BEFORE clearing form (need DOM positions)
  flyTaskToProject(savedTitle, savedProjectId)

  await taskStore.createTaskWithUndo({
    title: savedTitle,
    description: newTask.description?.trim() || undefined,
    priority: newTask.priority,
    dueDate: newTask.dueDate,
    projectId: savedProjectId,
    estimatedDuration: newTask.estimatedDuration,
    status: 'todo'
  })

  // Show confirmation
  clearTimeout(confirmTimeout)
  lastAdded.value = { title: savedTitle.length > 40 ? savedTitle.slice(0, 40) + '…' : savedTitle, project: savedProject }
  confirmTimeout = setTimeout(() => { lastAdded.value = null }, 2500)

  // Reset form but keep priority/dueDate/projectId for convenience
  newTask.title = ''
  newTask.description = undefined

  // Re-focus title input
  nextTick(() => {
    titleInputRef.value?.focus()
  })
}

function handleTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canAddTask.value) {
      void handleAddTask()
    }
  }
}

function handleDescriptionKeydown(event: KeyboardEvent) {
  // Shift+Enter to add task from description
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault()
    if (canAddTask.value) {
      void handleAddTask()
    }
  }
}

function setDueDate(preset: string) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'today':
      break
    case 'tomorrow':
      date.setDate(date.getDate() + 1)
      break
    case 'in3days':
      date.setDate(date.getDate() + 3)
      break
    case 'weekend': {
      const dayOfWeek = date.getDay()
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
      date.setDate(date.getDate() + daysUntilSaturday)
      break
    }
    case 'nextweek':
      date.setDate(date.getDate() + 7)
      break
    case 'in2weeks':
      date.setDate(date.getDate() + 14)
      break
    case 'in30days':
      date.setDate(date.getDate() + 30)
      break
  }

  newTask.dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function handleDatePickerUpdate(timestamp: number | null) {
  if (!timestamp) {
    newTask.dueDate = undefined
    return
  }
  const d = new Date(timestamp)
  newTask.dueDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getProjectName(projectId: string): string {
  const project = taskStore.projects.find(p => p.id === projectId)
  return project?.name || 'Unknown'
}

// Focus title input on mount
onMounted(() => {
  nextTick(() => {
    titleInputRef.value?.focus()
  })
})

// Expose focus method for parent
defineExpose({
  focus: () => titleInputRef.value?.focus()
})
</script>

<style scoped>
.quick-capture-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Capture Form */
.capture-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  max-width: 600px;
  margin: 0 auto;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.title-input-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.capture-input {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  transition: border-color var(--duration-normal), box-shadow var(--duration-normal);
}

.capture-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-alpha-20);
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.title-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  font-weight: var(--font-medium);
}

.title-input.voice-active {
  border-color: var(--danger-text, #ef4444);
  box-shadow: 0 0 0 3px var(--danger-bg-medium);
}

/* Mic Button (TASK-1024) */
.mic-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--duration-fast), color var(--duration-fast), transform var(--duration-fast);
}

.mic-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.mic-btn:active {
  transform: scale(0.95);
}

.mic-btn.recording {
  background: var(--danger-text, #ef4444);
  color: white;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--danger-shadow-strong);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 20px;
}

.wave-bar {
  width: 3px;
  height: 6px;
  background: var(--danger-text, #ef4444);
  border-radius: var(--radius-xs);
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { height: 6px; }
  50% { height: 16px; }
}

.voice-status {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-cancel {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.voice-cancel:hover {
  background: var(--glass-bg);
  color: var(--danger-text, #ef4444);
}

/* Voice error message */
.voice-error {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--danger-text, #ef4444);
}

/* TASK-1325: URL Scraping Feedback */
.url-scraping-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-primary);
}

.scraping-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.scraping-status {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--brand-primary);
}

.scraping-cancel {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.scraping-cancel:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.description-input {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  resize: none;
  min-height: unset;
  max-height: 120px;
  line-height: var(--leading-relaxed);
  overflow-y: auto;
  field-sizing: content; /* Auto-grow with content (modern browsers) */
}

/* Metadata Row */
.metadata-row {
  display: flex;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.metadata-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.metadata-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-buttons,
.date-shortcuts {
  display: flex;
  gap: var(--space-1);
}

.priority-btn,
.date-btn {
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--duration-normal), border-color var(--duration-normal), color var(--duration-normal);
}

.priority-btn:hover,
.date-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.priority-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.priority-btn.low.active {
  background: transparent;
  border-color: var(--success);
  color: var(--success);
}

.priority-btn.medium.active {
  background: transparent;
  border-color: var(--warning);
  color: var(--warning);
}

.priority-btn.high.active {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
}

.date-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.date-picker-trigger {
  padding: var(--space-1_5) var(--space-2);
}

.date-btn.clear {
  padding: var(--space-1_5);
  color: var(--danger);
  border-color: var(--danger-muted);
}

.date-btn.clear:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
}

/* Project Selection */
.project-group {
  width: 100%;
}

.project-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1_5);
}

.project-pill {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.project-pill:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.project-pill.active {
  background: var(--brand-bg);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.project-pill.clear {
  padding: var(--space-1_5);
}

.project-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

/* Success Confirmation */
.add-confirmation {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--brand-primary-alpha-10, rgba(78, 205, 196, 0.1));
  border: 1px solid var(--brand-primary-alpha-20, rgba(78, 205, 196, 0.2));
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-xs);
}

.add-confirmation .lucide {
  flex-shrink: 0;
}

.confirm-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.confirm-text strong {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.confirm-fade-enter-active {
  transition: opacity var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out);
}

.confirm-fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-in), transform var(--duration-normal) var(--ease-in);
}

.confirm-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.confirm-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Action Row */
.action-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

.capture-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5, 6px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  background: var(--glass-bg-soft, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--brand-primary, #4ECDC4);
  border-radius: var(--radius-md, 8px);
  color: var(--brand-primary, #4ECDC4);
  font-size: var(--text-sm, 14px);
  font-weight: var(--font-semibold, 600);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.capture-add-btn:hover:not(:disabled) {
  background: var(--glass-bg-medium, rgba(255, 255, 255, 0.1));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--brand-primary-alpha-20, rgba(78, 205, 196, 0.2));
  color: var(--brand-hover, #3db8af);
  border-color: var(--brand-hover, #3db8af);
}

.capture-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: var(--glass-border, rgba(255, 255, 255, 0.1));
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  background: transparent;
}

.capture-kbd {
  font-size: 10px;
  padding: 1px var(--space-1, 4px);
  background: var(--glass-bg-medium, rgba(255, 255, 255, 0.1));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xs, 4px);
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  font-family: inherit;
  line-height: 1.4;
}

/* Character count */
.char-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.char-count.near-limit {
  color: var(--warning, #f59e0b);
}

/* Task destination hint */
.task-destination {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.task-destination .lucide {
  color: var(--brand-primary);
}

/* Duration Estimate Buttons */
.duration-buttons {
  display: flex;
  gap: var(--space-1);
}

.duration-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--duration-normal), border-color var(--duration-normal), color var(--duration-normal);
}

.duration-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.duration-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.duration-btn.quick.active {
  border-color: var(--success);
  color: var(--success);
}

.duration-btn.short.active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.duration-btn.medium.active {
  border-color: var(--warning);
  color: var(--warning);
}

.duration-btn.long.active {
  border-color: var(--danger);
  color: var(--danger);
}

/* Responsive */
@media (max-width: 640px) {
  .metadata-row {
    flex-direction: column;
    gap: var(--space-4);
  }

  .priority-buttons,
  .date-shortcuts {
    flex-wrap: wrap;
  }

  .duration-buttons {
    flex-wrap: wrap;
  }
}
</style>
