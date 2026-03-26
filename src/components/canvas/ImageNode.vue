<template>
  <div class="image-node" :class="{ 'is-selected': selected }">
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="target" :position="Position.Right" id="right" />
    <Handle type="target" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Left" id="left" />
    <Handle type="source" :position="Position.Top" id="source-top" />
    <Handle type="source" :position="Position.Right" id="source-right" />
    <Handle type="source" :position="Position.Bottom" id="source-bottom" />
    <Handle type="source" :position="Position.Left" id="source-left" />

    <img
      :src="data.imageUrl"
      class="node-image"
      draggable="false"
      alt="Pasted image"
      @dblclick.stop="showLightbox = true"
    />

    <Teleport to="body">
      <div
        v-if="showLightbox"
        ref="lightboxRef"
        class="image-lightbox"
        @click="closeLightbox"
        @keydown.escape="closeLightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        tabindex="-1"
      >
        <img :src="data.imageUrl" class="lightbox-img" alt="Full size preview" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  data: {
    imageUrl: string
    imageId: string
  }
  // TASK-1690: forward VueFlow selection state for visible selection ring
  selected?: boolean
}

defineProps<Props>()

const showLightbox = ref(false)
const lightboxRef = ref<HTMLElement | null>(null)

function closeLightbox() {
  showLightbox.value = false
  nextTick(() => {
    ;(document.querySelector('.canvas-container') as HTMLElement)?.focus()
  })
}

watch(showLightbox, (val) => {
  if (val) {
    nextTick(() => lightboxRef.value?.focus())
  }
})
</script>

<style scoped>
.image-node {
  background: var(--glass-bg-soft);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  min-width: 120px;
  max-width: 400px;
  cursor: grab;
  transition: all var(--duration-normal) var(--ease-out);
}

.image-node:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 0 12px var(--brand-primary-alpha-20);
}

/* TASK-1690: Selected state — visible ring using brand token */
.image-node.is-selected {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary);
}

.node-image {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: var(--radius-md);
  cursor: zoom-in;
  display: block;
}
</style>

<style>
.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: var(--radius-lg);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}
</style>
