# SOP-026: Mobile Route Guards

**Created**: 2026-01-23
**Related**: BUG-1014, ROAD-004, TASK-346

---

## Problem

Mobile-only routes (e.g., `/mobile-quick-sort`) can be accessed on desktop browsers, causing the mobile UI to render inside the desktop layout shell. This creates a broken hybrid UI.

**Symptoms:**
- Mobile bottom action bars appearing on desktop
- Mobile-style buttons (Low/Med/High, Today/Tmrw/Wknd) in desktop content area
- URL shows `#/mobile-*` route on desktop browser

**Root Cause:**
- Vue Router had no guards preventing desktop users from accessing mobile routes
- `App.vue` correctly chooses layout based on viewport, but the `<router-view>` inside `MainLayout` loads whatever component the route specifies
- Result: Mobile view component renders inside desktop layout

---

## Solution

### Route Guard Pattern

Add a navigation guard in `src/router/index.ts` that redirects desktop users away from mobile routes:

```typescript
// Mobile detection helper (mirrors useMobileDetection.ts logic)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = navigator.userAgent || navigator.vendor || (window as typeof window & { opera?: string }).opera || ''
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches
  return isMobileUA || isSmallScreen
}

// Mobile route to desktop equivalent mapping
const mobileToDesktopRedirects: Record<string, string> = {
  'mobile-quick-sort': 'quick-sort',
  'mobile-today': 'canvas',
  'mobile-timer': 'canvas',
}

// In router.beforeEach():
const routeName = to.name as string
if (routeName && routeName in mobileToDesktopRedirects && !isMobileDevice()) {
  const desktopRoute = mobileToDesktopRedirects[routeName]
  console.log(`[BUG-1014] Desktop user on mobile route - redirecting`)
  next({ name: desktopRoute })
  return
}
```

---

## When Adding New Mobile Routes

**ALWAYS follow this checklist:**

1. **Name the route with `mobile-` prefix**
   ```typescript
   { path: '/mobile-inbox', name: 'mobile-inbox', ... }
   ```

2. **Add to redirect mapping**
   ```typescript
   const mobileToDesktopRedirects = {
     // ... existing
     'mobile-inbox': 'catalog',  // Add new mapping
   }
   ```

3. **Test on desktop browser**
   - Manually visit `/#/mobile-inbox`
   - Verify redirect to desktop equivalent

4. **Test on mobile device/emulator**
   - Verify mobile route loads correctly
   - Verify mobile layout renders (not desktop)

---

## Architecture Notes

### Why Not Use Route Meta?

Could use `meta: { mobileOnly: true }` but the redirect mapping is more explicit:
- Shows exact desktop equivalent for each mobile route
- Easier to maintain parity between mobile/desktop features
- Self-documenting

### Why Duplicate Mobile Detection?

`useMobileDetection.ts` is a Vue composable (uses `ref`, `onMounted`). Router guards run before component mount, so we need a plain function.

### Layout Selection Flow

```
User visits URL
       │
       ▼
┌─────────────────┐
│ Router Guard    │ ─── Desktop on mobile route? ─── Redirect
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ App.vue         │ ─── isMobile? ─── MobileLayout : MainLayout
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Layout          │ ─── <router-view> renders component
└─────────────────┘
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/router/index.ts` | Route definitions + guards |
| `src/composables/useMobileDetection.ts` | Vue composable for mobile detection |
| `src/App.vue` | Layout selection (MobileLayout vs MainLayout) |
| `src/mobile/layouts/MobileLayout.vue` | Mobile layout shell |
| `src/layouts/MainLayout.vue` | Desktop layout shell |

---

## Testing

```bash
# Desktop browser tests
1. Visit /#/mobile-quick-sort → Should redirect to /#/quick-sort
2. Visit /#/today → Should redirect to /#/ (canvas)
3. Visit /#/timer → Should redirect to /#/ (canvas)

# Mobile browser/emulator tests
1. Visit /#/mobile-quick-sort → Should load MobileQuickSortView
2. Verify MobileLayout renders (no desktop sidebar)
```
