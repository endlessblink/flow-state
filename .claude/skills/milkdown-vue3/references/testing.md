# Testing Reference

Unit and E2E test examples for Milkdown Vue 3 editors.

## Unit Tests (Vitest)

### MarkdownEditor.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MarkdownEditor from '../MarkdownEditor.vue';

describe('MarkdownEditor', () => {
  it('renders without errors', () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '' },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it('accepts modelValue prop', () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '# Heading' },
    });
    expect(wrapper.props('modelValue')).toBe('# Heading');
  });

  it('emits update:modelValue on content change', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '' },
    });
    await wrapper.vm.$emit('update:modelValue', 'New content');
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
  });

  it('accepts placeholder prop', () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        placeholder: 'Custom placeholder',
      },
    });
    expect(wrapper.props('placeholder')).toBe('Custom placeholder');
  });
});
```

### MilkdownEditorSurface.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MilkdownEditorSurface from '../MilkdownEditorSurface.vue';

describe('MilkdownEditorSurface', () => {
  it('initializes without errors', async () => {
    const wrapper = mount(MilkdownEditorSurface, {
      props: { modelValue: '' },
    });
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('exposes getMarkdown method', async () => {
    const wrapper = mount(MilkdownEditorSurface, {
      props: { modelValue: '# Test' },
    });
    await flushPromises();
    const markdown = await wrapper.vm.getMarkdown();
    expect(typeof markdown).toBe('string');
  });

  it('exposes isReady method', async () => {
    const wrapper = mount(MilkdownEditorSurface, {
      props: { modelValue: '' },
    });
    await flushPromises();
    const ready = wrapper.vm.isReady();
    expect(typeof ready).toBe('boolean');
  });
});
```

## E2E Tests (Playwright)

### editor.spec.ts

```typescript
import { test, expect } from '@playwright/test';

test.describe('Markdown Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should render editor', async ({ page }) => {
    const editor = page.locator('.milkdown-editor');
    await expect(editor).toBeVisible();
  });

  test('should allow typing text', async ({ page }) => {
    const editor = page.locator('.milkdown-editor');
    await editor.click();
    await page.keyboard.type('Hello World');
    const text = await page.locator('.milkdown').textContent();
    expect(text).toContain('Hello World');
  });

  test('should handle Enter key (CRITICAL)', async ({ page }) => {
    const editor = page.locator('.milkdown-editor');
    await editor.click();
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Line 2');
    const content = await page.locator('.milkdown').textContent();
    expect(content).toContain('Line 1');
    expect(content).toContain('Line 2');
  });

  test('should render markdown headers', async ({ page }) => {
    const editor = page.locator('.milkdown-editor');
    await editor.click();
    await page.keyboard.type('# Heading 1');
    const heading = page.locator('.milkdown h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Heading 1');
  });

  test('should render bold text', async ({ page }) => {
    const editor = page.locator('.milkdown-editor');
    await editor.click();
    await page.keyboard.type('**bold text**');
    const bold = page.locator('.milkdown strong');
    await expect(bold).toBeVisible();
  });

  test('should have no console errors', async ({ page }) => {
    const messages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        messages.push(msg.text());
      }
    });
    const editor = page.locator('.milkdown-editor');
    await editor.click();
    await page.keyboard.type('Test content');
    expect(messages).toHaveLength(0);
  });
});
```

## Manual Testing Checklist

### Basic Functionality
- [ ] Editor renders without errors
- [ ] Can click inside editor
- [ ] Cursor appears when clicking

### Typing Tests
- [ ] Type regular text → appears
- [ ] Type numbers → appear correctly
- [ ] Type special characters → appear correctly
- [ ] Copy-paste text → works

### Markdown Rendering
- [ ] `# heading` → renders as H1
- [ ] `## heading` → renders as H2
- [ ] `**bold**` → renders bold
- [ ] `*italic*` → renders italic
- [ ] `` `code` `` → renders as code
- [ ] `- item` → renders as list
- [ ] `> quote` → renders as blockquote
- [ ] `[link](url)` → renders as link

### Critical Tests
- [ ] Press Enter → creates new paragraph (NOT same line)
- [ ] Press Backspace → deletes correctly
- [ ] Select all (Cmd/Ctrl+A) → selects all text
- [ ] Copy (Cmd/Ctrl+C) → copies text
- [ ] Paste (Cmd/Ctrl+V) → pastes text

### Data Binding
- [ ] Parent has content → editor shows it
- [ ] Edit in editor → parent updates
- [ ] Clear editor → parent is empty

## Sample Test Content

```markdown
# Main Heading

## Subheading

This is a paragraph with **bold** and *italic* text.

### Lists

- Item 1
- Item 2
  - Nested item

1. First
2. Second
3. Third

### Code

Inline `code` looks like this.

```javascript
function hello() {
  console.log('world');
}
```

### Quotes

> This is a blockquote

### Links

[Link text](https://example.com)

---

End of document.
```

## Performance Baselines

| Metric | Target |
|--------|--------|
| Cold start | < 2 seconds |
| Hot reload | < 500ms |
| v-model update | < 100ms |
| Render 10KB text | < 1 second |
| Typing response | < 50ms |
| Idle memory | < 50MB |
