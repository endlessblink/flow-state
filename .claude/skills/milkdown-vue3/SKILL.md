---
name: milkdown-vue3
description: This skill should be used when implementing, debugging, or fixing Milkdown markdown editors in Vue 3 applications. Triggers on Milkdown setup, WYSIWYG markdown editors, "editorView" context errors, Enter key not working in editor, and Vue 3 markdown editor implementation. Provides production-ready patterns that fix 5 critical bugs.
---

# Milkdown Vue 3 Skill

Implement production-ready Milkdown WYSIWYG markdown editors in Vue 3 with correct patterns that prevent common bugs.

## When to Use

- Setting up Milkdown in a Vue 3 project
- Debugging "Context editorView not found" errors
- Fixing Enter key not creating new paragraphs
- Implementing markdown editors with live preview
- Resolving Milkdown initialization issues

## The Pattern (MEMORIZE THIS)

### Parent Component (MarkdownEditor.vue)

```vue
<template>
  <div class="markdown-editor-wrapper">
    <!-- RULE: MilkdownProvider has NO props -->
    <MilkdownProvider>
      <!-- Pass all UI props to child component -->
      <MilkdownEditorSurface
        :modelValue="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :textDirection="textDirection"
        @update:modelValue="emit('update:modelValue', $event)"
      />
    </MilkdownProvider>
  </div>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue';
import MilkdownEditorSurface from './MilkdownEditorSurface.vue';

interface Props {
  modelValue: string;
  placeholder?: string;
  rows?: number;
  textDirection?: 'ltr' | 'rtl';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Start typing...',
  rows: 8,
  textDirection: 'ltr',
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [content: string];
}>();
</script>
```

### Child Component (MilkdownEditorSurface.vue)

```vue
<template>
  <div class="editor-surface-wrapper">
    <!-- RULE: Milkdown must be imported from @milkdown/vue -->
    <Milkdown class="milkdown-editor" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Milkdown, useEditor } from '@milkdown/vue';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx
} from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';

interface Props {
  modelValue: string;
  placeholder?: string;
  rows?: number;
  textDirection?: 'ltr' | 'rtl';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Start typing...',
  rows: 8,
  textDirection: 'ltr',
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [content: string];
}>();

const editorReady = ref(false);

// RULE: useEditor must follow EXACT pattern:
// Editor.make() → config() → use(nord) → use(preset) → create()
const { getEditor } = useEditor((root) => {
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, props.modelValue);
    })
    // RULE: Theme MUST come before preset
    .use(nord)
    // RULE: Preset comes after theme
    .use(commonmark)
    // RULE: .create() finalizes
    .create();
});

// RULE: All editor access in onMounted after awaiting getEditor()
onMounted(async () => {
  try {
    const editor = await getEditor();

    if (!editor) {
      console.error('Failed to initialize Milkdown editor');
      return;
    }

    editorReady.value = true;

    // RULE: Setup content change listener inside editor.action()
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (!view) {
        console.error('editorView context unavailable');
        return;
      }

      const originalUpdate = view.updateState.bind(view);

      view.updateState = (state: any) => {
        originalUpdate(state);
        const markdown = editor.toMarkdown();
        emit('update:modelValue', markdown);
      };
    });

    console.log('Milkdown editor initialized successfully');
  } catch (error) {
    console.error('Error initializing editor:', error);
  }
});

defineExpose({
  async getMarkdown() {
    const editor = await getEditor();
    return editor ? editor.toMarkdown() : '';
  },

  async setMarkdown(markdown: string) {
    const editor = await getEditor();
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (view) {
        const newDoc = view.state.schema.text(markdown);
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc));
      }
    });
  },

  isReady: () => editorReady.value,
});
</script>
```

## Critical Rules (DO NOT BREAK)

| Rule | Correct | Wrong |
|------|---------|-------|
| MilkdownProvider props | `<MilkdownProvider>` | `<MilkdownProvider :rows="4">` |
| useEditor chain | `.use(nord).use(commonmark).create()` | Missing theme or `.create()` |
| Theme order | `.use(nord).use(commonmark)` | `.use(commonmark).use(nord)` |
| Editor access | `const editor = await getEditor()` | `const editor = getEditor()` |
| Method access | `editor.method()` | `const { method } = editor` |

## Setup Command

```bash
npm install @milkdown/vue@7.18.0 @milkdown/core@7.18.0 @milkdown/preset-commonmark@7.18.0 @milkdown/theme-nord@7.18.0 prosemirror-state prosemirror-view prosemirror-model
```

## Common Errors & Quick Fixes

| Error | Fix |
|-------|-----|
| Context "editorView" not found | Add `.use(nord)` and `.create()` |
| editor.create is not a function | Add `.create()` at end of chain |
| can't access private field | Use `editor.method()`, not extracted |
| getEditor() is undefined | Use `const { getEditor } = useEditor(...)` |
| Extraneous non-props warning | Remove props from MilkdownProvider |

## Quick Test Checklist

After setup, verify:
1. Type text → appears in editor
2. Press Enter → creates new paragraph (CRITICAL)
3. Type `# heading` → displays as H1
4. Check console → no errors

## Add Strikethrough Support

```bash
npm install @milkdown/preset-gfm@7.18.0
```

Replace `commonmark` with `gfm`:
```typescript
import { gfm } from '@milkdown/preset-gfm';
.use(gfm)  // Instead of .use(commonmark)
```

## When Something Breaks

Check in order:
1. Is `.use(nord)` present?
2. Is `.create()` present?
3. Is `.use(nord)` BEFORE `.use(commonmark)`?
4. Is onMounted using async/await?
5. Are props off MilkdownProvider?
6. Is `<Milkdown />` in template?

## Reference Files

For detailed information, see `references/`:
- `context_errors.md` - All context error types and fixes
- `troubleshooting.md` - Systematic debugging guide
- `testing.md` - Unit and E2E test examples
- `implementation_checklist.md` - Step-by-step setup guide
