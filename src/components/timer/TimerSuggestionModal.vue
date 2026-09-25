<template>
  <BaseModal
    :is-open="isOpen"
    title="Ready to focus?"
    size="sm"
    show-footer
    :submit-on-enter="false"
    @close="emit('close')"
  >
    <p class="timer-suggestion-copy">
      You were inactive for at least 15 seconds. Start a focus timer?
    </p>
    <p v-if="error" class="timer-suggestion-error" role="alert">
      {{ error }}
    </p>

    <template #footer>
      <div class="timer-suggestion-actions">
        <BaseButton variant="ghost" class="discard-action" @click="emit('discardToday')">
          Discard for today
        </BaseButton>
        <BaseButton variant="secondary" @click="emit('close')">
          Not now
        </BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="emit('start')">
          Start timer
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'

defineProps<{
  isOpen: boolean
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  close: []
  start: []
  discardToday: []
}>()
</script>

<style scoped>
.timer-suggestion-copy {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.timer-suggestion-error {
  margin: var(--space-3) 0 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.timer-suggestion-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  width: 100%;
}

.discard-action {
  margin-inline-end: auto;
}

@media (max-width: 440px) {
  .timer-suggestion-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .discard-action {
    margin-inline-end: 0;
  }
}
</style>
