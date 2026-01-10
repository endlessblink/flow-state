# Example: Template Style Tag Fix

## Problem
Story's runtime template contained `<style>` tag, causing Vue compilation error: "Tags with side effect (<script> and <style>) are ignored"

## Detection
Runtime templates with `<style>` or `<script>` tags.

Run: `grep -rn "template:" src/stories/ | grep -E "<style|<script"`

## Before Code
```typescript
export const Default: Story = {
  render: () => ({
    components: { MyComponent },
    template: `
      <div>
        <style>
          .my-class { color: red; }
        </style>
        <MyComponent />
      </div>
    `
  })
}
```

**Error:**
```
[Vue warn]: Tags with side effect (<script> and <style>) are ignored in client-side component templates.
```

## After Code (Option A - Inline Styles)
```typescript
export const Default: Story = {
  render: () => ({
    components: { MyComponent },
    template: `
      <div style="color: red;">
        <MyComponent />
      </div>
    `
  })
}
```

## After Code (Option B - CSS Variables)
```typescript
export const Default: Story = {
  render: () => ({
    components: { MyComponent },
    template: `
      <div style="color: var(--color-priority-high);">
        <MyComponent />
      </div>
    `
  })
}
```

## After Code (Option C - Global Styles)
If the style is needed for all stories, add it to the component's scoped styles instead:

```vue
<!-- MyComponent.vue -->
<style scoped>
.my-class {
  color: var(--color-priority-high);
}
</style>
```

Then in the story:
```typescript
export const Default: Story = {
  render: () => ({
    components: { MyComponent },
    template: `
      <div class="my-class">
        <MyComponent />
      </div>
    `
  })
}
```

## Solution
Removed `<style>` tag from runtime template and used inline styles with CSS variables.

**Why this matters:**
- Vue runtime templates don't support `<style>` or `<script>` tags
- These tags are ignored by Vue, causing unexpected behavior
- Use component scoped styles or inline styles instead

## Verification
1. Open Storybook
2. Navigate to the story
3. Confirm component renders correctly
4. Confirm no Vue warnings in console

## Related
- Check 3: Template Validation
- dev-storybook: Vue 3 Template Restrictions
