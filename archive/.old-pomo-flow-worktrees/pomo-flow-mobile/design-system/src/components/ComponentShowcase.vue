<template>
  <div class="showcase">
    <div class="showcase-header">
      <h3 class="showcase-title">{{ title }}</h3>
      <div class="header-actions">
        <button v-if="code" @click="toggleCode" class="toggle-code-btn" title="Toggle code">
          <ChevronDown v-if="!showCode" :size="16" />
          <ChevronUp v-else :size="16" />
        </button>
        <button @click="copyCode" class="copy-btn" :class="{ copied: showCopied }">
          <Check v-if="showCopied" :size="16" />
          <Copy v-else :size="16" />
          <span>{{ showCopied ? 'Copied!' : 'Copy' }}</span>
        </button>
      </div>
    </div>

    <div class="showcase-preview" @click="copyCode">
      <slot />
    </div>

    <div v-if="code && showCode" class="showcase-code">
      <pre><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-vue-next'

interface Props {
  title: string
  code: string
}

const props = defineProps<Props>()

const showCopied = ref(false)
const showCode = ref(false)

const toggleCode = () => {
  showCode.value = !showCode.value
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.code)
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.showcase {
  background: var(--surface-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-6);
  transition: all var(--duration-normal);
}

.showcase:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-md);
}

.showcase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--surface-tertiary);
  border-bottom: 1px solid var(--border-primary);
}

.showcase-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.toggle-code-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.toggle-code-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--state-hover-bg);
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
}

.copy-btn:hover {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--brand-primary);
  box-shadow: var(--state-hover-glow);
}

.copy-btn.copied {
  background: var(--color-work);
  border-color: var(--color-work);
  color: white;
}

.showcase-preview {
  padding: var(--space-6);
  cursor: pointer;
  transition: background var(--duration-fast);
}

.showcase-preview:hover {
  background: var(--surface-hover);
}

.showcase-code {
  padding: var(--space-4);
  background: var(--bg-primary);
  border-top: 1px solid var(--border-primary);
}

.showcase-code pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  overflow-x: auto;
}

.showcase-code code {
  display: block;
  white-space: pre;
}
</style>
