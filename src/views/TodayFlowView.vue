<template>
  <div
    ref="containerRef"
    class="today-flow"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div class="flow-content">
      <!-- All done celebration -->
      <Transition name="fade-up" appear>
        <div v-if="allSlotsCompleted" class="flow-celebration">
          <div class="celebration-icon">
            🎉
          </div>

          <h2 class="celebration-title">
            All tasks complete!
          </h2>

          <p class="celebration-subtitle">
            Great day! You crushed your Big 3.
          </p>

          <router-link to="/" class="flow-link">
            View full board →
          </router-link>
        </div>
      </Transition>

      <template v-if="!allSlotsCompleted">
        <!-- Active task card -->

        <div class="flow-active">
          <TransitionGroup name="card-swap">
            <FlowTaskCard
              v-for="(slot, i) in big3Slots"
              v-show="cardStates[i] === 'active'"
              :key="'active-' + i"
              :task-id="slot.taskId || `manual-${i}`"
              :title="slot.title"
              state="active"
              :index="i"
              @start="handleStart(i)"
              @pause="handlePause"
              @resume="handleResume"
              @complete="handleComplete(i)"
            />
          </TransitionGroup>
        </div>

        <!-- Queued/completed cards -->

        <div class="flow-queue">
          <TransitionGroup name="card-fade">
            <FlowTaskCard
              v-for="(slot, i) in big3Slots"
              v-show="cardStates[i] !== 'active'"
              :key="'queue-' + i"
              :task-id="slot.taskId || `manual-${i}`"
              :title="slot.title"
              :state="cardStates[i]"
              :index="i"
              @promote="handlePromote(i)"
            />
          </TransitionGroup>
        </div>


        <router-link to="/" class="flow-link">
          View full board →
        </router-link>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import FlowTaskCard from '@/components/today-flow/FlowTaskCard.vue'
import { useMorningDashboard } from '@/composables/useMorningDashboard'
import { useTimerStore } from '@/stores/timer'

const router = useRouter()
const timerStore = useTimerStore()
const { big3Slots, completeSlot, allSlotsCompleted } = useMorningDashboard()

const containerRef = ref<HTMLElement | null>(null)

// Track which slot index is currently active (0, 1, or 2)
const activeIndex = ref(0)

// Computed: derive card states from big3Slots
const cardStates = computed(() => {
  return big3Slots.value.map((slot, i) => {
    if (slot.completed) return 'completed' as const
    if (i === activeIndex.value) return 'active' as const
    return 'queued' as const
  })
})

// Auto-advance: when current slot completed, find next non-completed
watch(
  () => big3Slots.value[activeIndex.value]?.completed,
  (isCompleted) => {
    if (isCompleted) {
      const next = big3Slots.value.findIndex(
        (s, i) => i > activeIndex.value && !s.completed
      )
      if (next !== -1) {
        setTimeout(() => {
          activeIndex.value = next
        }, 400) // wait for completion animation
      }
    }
  }
)

function handleStart(index: number) {
  const slot = big3Slots.value[index]
  if (slot.taskId) {
    timerStore.startTimer(slot.taskId)
  } else {
    timerStore.startTimer('general') // manual task without ID
  }
}

function handlePause() {
  timerStore.pauseTimer()
}

function handleResume() {
  timerStore.resumeTimer()
}

function handleComplete(index: number) {
  timerStore.stopTimer()
  completeSlot(index)
}

function handlePromote(index: number) {
  // User clicked a queued card to make it active
  activeIndex.value = index
}

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  if (e.key === ' ') {
    e.preventDefault()
    if (!timerStore.isTimerActive) handleStart(activeIndex.value)
    else if (timerStore.isPaused) handleResume()
    else handlePause()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    // Cycle to next non-completed slot
    const next = big3Slots.value.findIndex(
      (s, i) => i !== activeIndex.value && !s.completed
    )
    if (next !== -1) activeIndex.value = next
  } else if (e.key === 'Enter' || e.key === 'c' || e.key === 'C') {
    handleComplete(activeIndex.value)
  } else if (e.key === 'Escape') {
    timerStore.stopTimer()
    router.push('/')
  }
}

onMounted(() => {
  containerRef.value?.focus()
})

onUnmounted(() => {
  // Leave timer running — user may have navigated away intentionally
})
</script>

<style scoped>
.today-flow {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  outline: none; /* remove focus ring on container */
}

.flow-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
  gap: var(--space-6);
}

.flow-active {
  width: 100%;
}

.flow-queue {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  width: 100%;
}

.flow-link {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-decoration: none;
  transition: color var(--duration-normal) var(--ease-out);
}

.flow-link:hover {
  color: var(--brand-primary);
}

/* Celebration */
.flow-celebration {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.celebration-icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.celebration-title {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 var(--space-2);
}

.celebration-subtitle {
  color: var(--text-secondary);
  margin: var(--space-2) 0 var(--space-6);
}

/* Transitions */
.fade-up-enter-active {
  transition: opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out);
}

.fade-up-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.card-swap-enter-active,
.card-swap-leave-active {
  transition: opacity 0.3s var(--ease-out), transform 0.3s var(--ease-out);
}

.card-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.card-swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.card-fade-enter-active,
.card-fade-leave-active {
  transition: opacity 0.25s var(--ease-out);
}

.card-fade-enter-from,
.card-fade-leave-to {
  opacity: 0;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .fade-up-enter-active,
  .card-swap-enter-active,
  .card-swap-leave-active,
  .card-fade-enter-active,
  .card-fade-leave-active {
    transition: none;
  }

  .fade-up-enter-from,
  .card-swap-enter-from,
  .card-swap-leave-to,
  .card-fade-enter-from,
  .card-fade-leave-to {
    opacity: 1;
    transform: none;
  }
}

/* Responsive */
@media (max-width: 600px) {
  .flow-queue {
    grid-template-columns: 1fr;
  }

  .flow-content {
    padding: var(--space-4);
    gap: var(--space-4);
  }
}
</style>
