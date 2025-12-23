# Storybook Glass Morphism Debugging SOP

**Date**: 2025-12-23
**Focus**: Debugging and verifying "Glass Morphism" styles in Storybook

## 1. Problem Identification
When working with glassmorphism (translucency, blur, fixed positioning) in Storybook, common issues include:
*   **Invisible Components**: Component blends into the background or has no background.
*   **Clipping**: Fixed/absolute positioned elements (modals, context menus) are cut off by the iframe boundary.
*   **Missing Blur**: Backdrop-filter effects rely on underlying content, which might be solid black in Storybook.
*   **Wrong Tokens**: Using `var(--glass-bg-solid)` (opaque) instead of `var(--overlay-component-bg)` (translucent).

## 2. Standard Fixes

### A. Visibility & Contrast
Ensure the story container has a background that highlights the glass effect (e.g., a dark gradient or image, not just solid black).

**Storybook Parameter Fix:**
```typescript
parameters: {
    backgrounds: {
        default: 'dark-glass-context',
        values: [
            { name: 'dark-glass-context', value: '#1a1b2e' }
        ]
    }
}
```

### B. Positioning & Clipping for Modals/Context Menus
Fixed-position elements often misbehave in standard story layouts (`centered` or `padded`).

**The "Scale Transform" Hack:**
Wraps the story in a container with `transform: scale(1)`. This creates a new stacking context and viewport reference for fixed elements inside the iframe.

```typescript
decorators: [
    (story) => ({
        components: { story },
        template: `
            <div style="transform: scale(1); height: 100vh; width: 100vw; position: relative; background: linear-gradient(45deg, #2c3e50, #000000);">
                <story />
            </div>
        `
    })
],
parameters: {
    layout: 'fullscreen' // CRITICAL: Use fullscreen, not centered
}
```

### C. Tokenization Audit
Search for and replace hardcoded styles with standard tokens.

**Bad:**
```css
background: rgba(0, 0, 0, 0.8);
border: 1px solid rgba(255, 255, 255, 0.1);
backdrop-filter: blur(20px);
box-shadow: 0 10px 30px rgba(0,0,0,0.5);
```

**Good:**
```css
background: var(--overlay-component-bg); /* or --overlay-component-bg-lighter */
border: var(--overlay-component-border);
backdrop-filter: var(--overlay-component-backdrop);
box-shadow: var(--overlay-component-shadow);
```

## 3. Workflow Checklist

1.  **Locate Component**: Open `src/components/.../Component.vue`.
2.  **Audit CSS**: Check `<style>` block for hardcoded `rgba` or `box-shadow`.
3.  **Apply Tokens**: Replace with `var(--overlay-component-*)` family.
4.  **Check Story**: Open `src/stories/.../Component.stories.ts`.
5.  **Fix Layout**: Ensure `layout: 'fullscreen'` and apply the transform decorator if it's a modal/menu.
6.  **Verify**: Run `npm run storybook` and visually confirm the glass effect (translucency + blur).

## 4. Specific Token Mapping

| Hardcoded Value (Approx) | Design Token |
|--------------------------|--------------|
| `rgba(30, 30, 46, 0.85)` | `var(--overlay-component-bg)` |
| `rgba(30, 30, 46, 0.6)` | `var(--overlay-component-bg-lighter)` |
| `blur(20px)` | `var(--overlay-component-backdrop)` |
| `1px solid rgba(255...0.1)` | `var(--overlay-component-border)` |
| `rgba(0, 0, 0, 0.5)` (overlay) | `var(--overlay-bg)` |
