<template>
  <div class="milkdown-surface" :dir="textDirection">
    <Milkdown />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Milkdown, useEditor } from '@milkdown/vue'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, EditorStatus } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { replaceAll } from '@milkdown/utils'

interface Props {
  modelValue: string
  textDirection: 'ltr' | 'rtl'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'editor-ready': [editor: Editor]
}>()

useEditor((root) => {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, props.modelValue)
      
      const l = ctx.get(listenerCtx)
      l.markdownUpdated((_ctx, markdown) => {
        emit('update:modelValue', markdown)
      })
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    
  editor.onStatusChange((status) => {
    if (status === EditorStatus.Created) {
      emit('editor-ready', editor)
    }
  })

  return editor
})

// Handle external updates
watch(() => props.modelValue, (newVal, oldVal) => {
  // We only sync if the update is truly external (different from current state)
  // The parent component should handle the "internalValue" logic
})
</script>

<style scoped>
.milkdown-surface {
  width: 100%;
  height: 100%;
}

:deep(.milkdown .editor) {
  white-space: pre-wrap !important;
}
</style>
