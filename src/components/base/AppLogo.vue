<template>
  <img
    v-if="!loadError"
    :src="logoUrl"
    :width="sizeValue"
    :height="sizeValue"
    alt=""
    class="app-logo"
    :class="{ 'app-logo--round': round }"
    draggable="false"
    @error="loadError = true"
  >
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import logoUrl from '@/assets/logo-glitch-tomato.png'

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  round?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  round: false
})

const sizeMap: Record<string, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64
}

const loadError = ref(false)

const sizeValue = computed(() =>
  typeof props.size === 'number' ? props.size : sizeMap[props.size]
)
</script>

<style scoped>
.app-logo {
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  flex-shrink: 0;
}

.app-logo--round {
  border-radius: var(--radius-full);
}
</style>
