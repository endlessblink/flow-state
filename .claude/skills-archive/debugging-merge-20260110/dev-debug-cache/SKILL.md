# Vue 3 Cache Troubleshooting Expert

**Version:** 1.0.0
**Category:** Debug
**Dependencies:** node>=18.0.0, npm>=9.0.0

## Overview

Systematic troubleshooting for Vue 3 development cache issues that persist even after disabling browser cache and attempting hard refresh (Ctrl+R/Cmd+R). Use this when the developer has already tried basic cache clearing methods without success.

## When to Activate This Skill

Invoke this skill when:
- Developer mentions cache issues in Vue 3 development
- Changes to Vue components are not appearing after refresh
- Hard refresh (Ctrl+R, Ctrl+Shift+R) does not work
- "Disable cache" in DevTools Network tab does not help
- Developer reports "my changes aren't showing up" or similar
- HMR (Hot Module Replacement) appears broken
- The app seems to be serving old/stale code

## Diagnostic Process

Follow this systematic 10-step approach to identify and resolve caching issues:

---

### Step 1: Identify Service Workers

**Priority:** 🔴 Critical (Most common cause)

Service workers are the #1 cause of persistent cache issues that bypass normal browser cache controls.

**Instructions:**

1. Guide developer to check for service workers:
   ```
   - Open DevTools (F12)
   - Go to **Application** tab
   - Click **Service Workers** in left sidebar
   - Check if any are registered
   ```

2. If service workers are found, provide unregistration code:

```javascript
// Add this temporarily to main.js or App.vue
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (const registration of registrations) {
      registration.unregister();
      console.log('Service worker unregistered:', registration);
    }
  });
}
```

3. After running the code, instruct to refresh and remove the code

---

### Step 2: Clear All Site Data (Not Just Cache)

**Priority:** 🔴 Critical

Browser cache is only one storage type. Many issues come from other storage mechanisms.

**Instructions:**

Guide developer through complete storage clearing:

1. Open DevTools (F12)
2. Go to **Application** tab
3. In left sidebar, find **Storage** section (not just Cache)
4. Click **Clear site data** button
5. Ensure ALL checkboxes are selected:
   - Local storage
   - Session storage
   - IndexedDB
   - Web SQL
   - Cookies
   - Cache storage
   - Service Workers
6. Click **Clear site data**
7. Close DevTools
8. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

### Step 3: Delete Vite Cache Directory

**Priority:** 🟠 High

Vite maintains its own dependency cache that operates independently of browser cache.

**Instructions:**

Provide these commands based on their setup:

```bash
# Stop the dev server first (Ctrl+C)

# Delete Vite's cache directory
rm -rf node_modules/.vite

# Or on Windows:
rmdir /s /q node_modules\.vite

# Then restart dev server
npm run dev
```

**Alternative: Force flag**

If the above works, suggest adding permanent force flag:

```json
// In package.json
"scripts": {
  "dev": "vite --force"
}
```

This automatically clears Vite's cache on every start.

---

### Step 4: Check for PWA Plugin Configuration

**Priority:** 🟠 High

If the project uses vite-plugin-pwa, it creates aggressive caching that can persist.

**Instructions:**

1. Check if `vite-plugin-pwa` exists in `package.json`
2. If found, check `vite.config.js` or `vite.config.ts` for PWA configuration
3. Temporarily disable PWA during development:

```javascript
// In vite.config.js
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // Disable service worker in development
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false  // Add this line
      }
    })
  ]
})
```

---

### Step 5: Verify HMR is Working

**Priority:** 🟡 Medium

Sometimes the issue isn't cache but broken Hot Module Replacement.

**Instructions:**

1. Ask developer to check the terminal where dev server is running
2. When they save a file, they should see output like:
   ```
   [vite] hmr update /src/components/MyComponent.vue
   ```
3. If they see "page reload" instead of "hmr update", HMR is broken

**For WSL2 users (Windows Subsystem for Linux):**

File watching is often broken in WSL2. Add polling to `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [vue()],
  server: {
    watch: {
      usePolling: true,
    },
    // Optional: if using WSL2 and accessing from Windows
    host: true,
  }
})
```

**Warning:** Polling uses more CPU but is necessary for WSL2

---

### Step 6: Check for Cached Dependencies Issue

**Priority:** 🟡 Medium

Sometimes newly installed or updated dependencies get cached incorrectly.

**Instructions:**

Execute complete cache purge:

```bash
# Stop dev server

# Clear npm cache
npm cache clean --force

# Delete all caches
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf dist

# Reinstall dependencies
rm -rf node_modules
npm install

# Restart dev server
npm run dev
```

---

### Step 7: Browser-Specific Debugging

**Priority:** 🟡 Medium

If issues persist, try isolated browser testing.

**Instructions:**

1. **Test in Incognito/Private mode**
   - No extensions or previous data
   - If it works here, the issue is browser-specific storage

2. **Disable Browser Extensions**
   - Extensions like uBlock, AdGuard, or React DevTools can interfere
   - Test with all extensions disabled

3. **Try Different Browser**
   - Test in Firefox, Chrome, Edge, Safari
   - If works in another browser, issue is browser-specific

4. **Clear DNS Cache** (if accessing via custom domain):
   ```bash
   # Windows
   ipconfig /flushdns

   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches
   ```

---

### Step 8: Windows 11 Localhost Bug (October 2025)

**Priority:** 🟢 Low (Platform-specific)

If on Windows 11 with recent updates, a known bug affects localhost.

**Instructions:**

If developer is on Windows 11 and updated in October 2025:

```powershell
# Run PowerShell as Administrator

# Disable HTTP/2 for localhost
New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\HTTP\Parameters' -Name 'EnableHttp2Tls' -PropertyType DWord -Value 0 -Force
New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\HTTP\Parameters' -Name 'EnableHttp2Cleartext' -PropertyType DWord -Value 0 -Force

# Restart computer
```

---

### Step 9: Verify Issue with Obvious Change

**Priority:** 🔴 Critical (Verification step)

Before proceeding further, verify caching is actually the problem.

**Instructions:**

Have developer make an **extremely obvious** change:

1. Open main App.vue or root component
2. Add huge red text at the top:
   ```vue
   <template>
     <div style="background: red; color: white; font-size: 48px; padding: 50px;">
       CACHE TEST - {{ Date.now() }}
     </div>
     <!-- rest of template -->
   </template>
   ```
3. Save the file
4. Check terminal - does Vite show HMR update?
5. Check browser - does the red banner appear?

**Results:**
- **If banner appears:** Cache is NOT the issue, something else is wrong
- **If banner doesn't appear:** Proceed with nuclear option below

---

### Step 10: Nuclear Option - Complete Reset

**Priority:** 🟢 Low (Last resort)

If all above steps fail, do complete environment reset.

**Instructions:**

```bash
# 1. Stop all Node processes
# Windows:
taskkill /F /IM node.exe
# macOS/Linux:
killall node

# 2. Delete everything
rm -rf node_modules
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf dist
rm -rf .vite
rm package-lock.json  # Or yarn.lock, pnpm-lock.yaml

# 3. Clear all caches
npm cache clean --force

# 4. Fresh install
npm install

# 5. Clear browser completely
# Go to chrome://settings/clearBrowserData
# Time range: "All time"
# Check ALL boxes
# Clear data

# 6. Restart browser completely (not just window)

# 7. Start dev server fresh
npm run dev

# 8. Test in new incognito window
```

---

## Additional Diagnostic Commands

Provide these commands if needed for specific scenarios:

**Check for port conflicts:**
```bash
# Windows
netstat -ano | findstr :5173

# macOS/Linux
lsof -i :5173
```

**Force different port:**
```bash
npm run dev -- --port 3000
```

**Check Vite config syntax:**
```bash
npx vite --debug
```

---

## Common Pitfalls to Avoid

**Don't suggest these (already tried):**
- ❌ Disabling cache in DevTools Network tab
- ❌ Ctrl+R or Ctrl+Shift+R hard refresh
- ❌ "Just clear your browser cache"
- ❌ Simple cache clearing from Settings

**Do prioritize:**
- ✅ Service worker unregistration
- ✅ Clearing ALL site data (not just cache)
- ✅ Deleting node_modules/.vite directory
- ✅ Checking for PWA plugin interference
- ✅ Verifying HMR is actually working
- ✅ WSL2-specific solutions if applicable

---

## Success Criteria

The issue is resolved when:

1. Developer makes a change to a Vue component
2. Vite terminal shows "hmr update" message
3. Browser updates without manual refresh
4. Changes appear immediately without any cache clearing

---

## Special Environment Troubleshooting

### If developer uses Docker:

- Cache issues can exist in container, not browser
- Need to rebuild container: `docker-compose down -v && docker-compose up --build`
- Check volume mounts aren't caching

### If using Vite proxy:

- Proxy can cache responses
- Check `server.proxy` configuration in vite.config.js
- May need to disable proxy caching

### If using Cloudflare or CDN in development:

- Development should NEVER use CDN
- Verify .env files and environment variables
- Check vite.config.js for base URL configuration

---

## Helper Script

Provide this automation script if developer needs it:

```bash
#!/bin/bash
# save as clear-vue-cache.sh

echo "🧹 Clearing all Vue 3 / Vite caches..."

# Stop dev server
echo "⏹️  Stopping dev servers..."
killall node 2>/dev/null

# Clear Vite cache
echo "🗑️  Clearing Vite cache..."
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf .vite

# Clear npm cache
echo "📦 Clearing npm cache..."
npm cache clean --force

# Done
echo "✅ All caches cleared!"
echo "💡 Now clear browser data manually (Application > Clear site data)"
echo "🚀 Then run: npm run dev"
```

Make executable: `chmod +x clear-vue-cache.sh`
Run: `./clear-vue-cache.sh`

---

## Example Conversation Flow

**Developer:** "My Vue 3 changes aren't showing up and cache disable + refresh doesn't work"

**Claude Response Using This Skill:**

1. "Let's diagnose this systematically. First, check if a service worker is causing this..."
2. Walk through Step 1 (Service Workers)
3. If not resolved, proceed to Step 2 (Clear All Site Data)
4. Continue through steps until resolved
5. Document which step solved it for future reference

---

## Relevant File Locations

When using this skill, reference these files:

- `vite.config.js` or `vite.config.ts` - main config
- `package.json` - to check for PWA plugins
- `main.js` or `main.ts` - entry point where service worker code can be added
- `.env` files - environment-specific settings
- `node_modules/.vite/` - Vite cache directory
- `node_modules/.cache/` - General cache directory

---

**Skill Activation Keywords:**
- cache, caching, not updating, changes not showing, stale, old code
- HMR broken, hot reload not working
- refresh doesn't work, hard refresh fails
- service worker, PWA issues
- Vite cache, development cache

**Skill Context:**
- Vue 3 projects
- Vite development server
- Localhost development
- Anti-patterns: "already tried refresh", "cache disable doesn't work"
