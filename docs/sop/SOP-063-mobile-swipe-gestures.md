# SOP-063: Mobile Swipe Gesture Implementation

## Purpose
Prevent regressions in mobile swipe gesture handling across touch (real devices) and mouse (desktop mobile emulation).

## Critical Rules

### 1. Touch Event Listener Configuration
```typescript
// CORRECT
el.addEventListener('touchstart', handler, { passive: true })  // ALWAYS passive
el.addEventListener('touchmove', handler, { passive: false })   // Active — needs preventDefault
el.addEventListener('touchend', handler, { passive: true })     // ALWAYS passive
```

**NEVER** call `preventDefault()` in `touchstart`. Android Chrome's compositor drops the entire touch sequence if touchstart is non-passive or calls preventDefault before direction is known.

### 2. Touch Move Handler Pattern
```typescript
const handleTouchMove = (e: TouchEvent) => {
  if (!isSwiping.value) return
  const touch = e.touches[0]

  // Step 1: Update position FIRST (so deltas reflect current movement)
  moveSwipe(touch.clientX, touch.clientY)

  // Step 2: Only block scroll AFTER 10px lock threshold
  if (!isLocked.value) return

  // Step 3: preventDefault based on direction
  if (fourDirectional) {
    e.preventDefault()
  } else if (absX > absY && lockVertical) {
    e.preventDefault()
  }
}
```

**Order matters**: `moveSwipe()` before `preventDefault()`. The 10px lock threshold gives the browser compositor time to recognize the gesture.

### 3. Mouse Support for Mobile Viewport
Desktop browsers resized to mobile width trigger `isMobileDevice()` via `matchMedia('(max-width: 768px)')` but use **mouse events**, not touch. Any swipeable component in a mobile view MUST enable `mouse: true`:

```typescript
useSwipeGestures(cardRef, {
  mouse: true,  // Required for desktop browsers in mobile viewport
  // ...
})
```

### 4. Z-Index and Pointer Events
Decorative/preview elements stacked above the active swipe target will intercept mouse events:
- Active card: `z-index: 1`
- Decorative stack cards: `z-index: 10` (higher!) + `pointer-events: none` (REQUIRED)

**Rule**: Any element visually stacked above a swipe target that shouldn't receive input MUST have `pointer-events: none`.

### 5. CSS for Scroll Containers
```css
/* CORRECT */
.sort-phase {
  touch-action: pan-y;  /* Allow vertical scroll, let JS handle horizontal */
}

/* WRONG — causes issues on some Android versions */
.sort-phase {
  -webkit-overflow-scrolling: touch;
}
```

### 6. Testing Checklist
Both scenarios MUST work:
- [ ] Real Android phone (PWA) — touch events
- [ ] Desktop browser resized to mobile width — mouse events

Automated test pattern:
```javascript
// Mouse drag test
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(cx + i * 8, cy);
  await page.waitForTimeout(16);
}
await page.mouse.up();

// Touch test (synthetic, must use rAF spacing for Vue reactivity)
await page.evaluate(({sx, sy}) => {
  return new Promise(resolve => {
    const card = document.querySelector('.task-card');
    const fire = (type, x, y) => {
      const touch = new Touch({identifier: 1, target: card, clientX: x, clientY: y});
      card.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [touch],
        targetTouches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch]
      }));
    };
    fire('touchstart', sx, sy);
    let i = 0;
    const step = () => {
      i++;
      fire('touchmove', sx + i * 8, sy);
      if (i < 20) requestAnimationFrame(step);
      else { fire('touchend', sx + 160, sy); resolve(); }
    };
    requestAnimationFrame(step);
  });
}, {sx, sy});
```

### 7. Key Files
| File | Role |
|------|------|
| `src/composables/useSwipeGestures.ts` | Core swipe composable (touch + mouse) |
| `src/mobile/components/MobileQuickSortCard.vue` | Quick sort swipe card |
| `src/mobile/views/MobileQuickSortView.vue` | Quick sort view (stack cards, sort phase) |

### 8. Working Reference
Commit `3a149cb6` — last known working version before the refactor that broke swipe. Compare against this when debugging swipe regressions.

## Related
- BUG-1453 in MASTER_PLAN.md
- `useSwipeGestures.ts` BUG-1453 comments in code
