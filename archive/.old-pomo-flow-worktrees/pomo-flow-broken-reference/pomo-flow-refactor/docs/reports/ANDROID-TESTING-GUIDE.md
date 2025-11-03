# Android Testing Guide - pomo-flow Mobile

**Status:** ✅ Build Successful - Ready to Test
**Date:** October 12, 2025

---

## What's Ready

✅ Mobile app built and synced to Android project
✅ Notification permissions added to manifest
✅ TodayView integrated with Pinia stores
✅ Haptic feedback on all interactions
✅ Swipe gestures implemented
✅ Quick capture with project/priority pickers

---

## Prerequisites

### 1. Enable USB Debugging on Your Android Phone

1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times (you'll see "You are now a developer!")
3. Go back to **Settings → System → Developer Options**
4. Enable **USB Debugging**
5. Connect your phone via USB cable
6. Accept the "Allow USB debugging?" prompt on your phone

### 2. Install Android Studio (If Not Already Installed)

**Download:** https://developer.android.com/studio

**What you need:**
- Android Studio (latest version)
- Android SDK installed (comes with Android Studio)

---

## Testing Steps

### Method 1: Using Android Studio (Recommended)

```bash
# 1. Open Android project in Android Studio
npx cap open android
```

**In Android Studio:**
1. Wait for Gradle sync to complete (first time: 5-10 minutes)
2. Select your device from the device dropdown (top toolbar)
   - If phone not showing: Check USB cable and USB debugging
3. Click the green **Run** button (▶) or press **Shift + F10**
4. Wait for build and install (~2-3 minutes first time)
5. App will launch automatically on your phone

### Method 2: Build APK and Install Manually

```bash
# 1. Build APK
cd android
./gradlew assembleDebug

# 2. APK location:
# android/app/build/outputs/apk/debug/app-debug.apk

# 3. Install on phone (if you have ADB)
adb install app/build/outputs/apk/debug/app-debug.apk

# OR: Copy APK to phone and install manually
```

---

## What to Test

### 1. App Launch
- [ ] App opens without crashes
- [ ] Splash screen shows briefly
- [ ] Today view loads

### 2. Navigation
- [ ] App URL: Visit `http://localhost:5546/#/today` in browser to see desktop version
- [ ] On phone: App should show mobile-optimized Today view automatically

### 3. Task List
- [ ] Tasks display correctly
- [ ] Swipe right on task → Should complete (haptic feedback)
- [ ] Swipe left on task → Should delete (haptic feedback)
- [ ] Tap task → Should log to console (detail modal not implemented yet)
- [ ] Pull down → Should refresh (haptic feedback)

### 4. Quick Capture (FAB Button)
- [ ] Tap floating blue + button
- [ ] Modal slides up from bottom
- [ ] Type task title
- [ ] Select project (optional)
- [ ] Select priority (optional)
- [ ] Select due date (optional)
- [ ] Tap "Add Task"
- [ ] Task appears in list immediately
- [ ] Haptic feedback on success

### 5. Notifications
- [ ] First launch: Permission dialog appears
- [ ] Grant notification permission
- [ ] Create a task → Should show notification (if implemented in test)
- [ ] Notifications appear in notification shade

### 6. Haptic Feedback
- [ ] Complete task → Success haptic (double buzz)
- [ ] Delete task → Light haptic (single buzz)
- [ ] Create task → Success haptic
- [ ] Refresh → Medium haptic

### 7. Data Persistence
- [ ] Create a task
- [ ] Close app completely (swipe away from recent apps)
- [ ] Reopen app
- [ ] Task should still be there (LocalForage persistence)

### 8. Performance
- [ ] App feels smooth (60fps)
- [ ] No lag when swiping
- [ ] Quick capture opens instantly
- [ ] No battery drain warning

---

## Known Limitations (Expected)

⚠️ **These are NOT bugs - they're features not implemented yet:**

- ❌ Real-time sync (server not deployed yet - shows "Offline" status)
- ❌ Pomodoro timer (timer UI shows but doesn't actually work yet)
- ❌ Task detail modal (tapping task just logs to console)
- ❌ Push notifications (no backend server yet)
- ❌ Background sync (Phase 2 feature)
- ❌ Home screen widgets (Phase 2 feature)

---

## Troubleshooting

### "Device not recognized in Android Studio"

```bash
# Check if phone is connected
adb devices

# Should show:
# List of devices attached
# ABC123XYZ    device

# If shows "unauthorized":
# - Check phone for USB debugging prompt
# - Unplug and replug USB cable
```

### "Gradle sync failed"

**Solution:** Wait and let it complete. First sync downloads dependencies (~500MB).

**If it fails:**
1. File → Invalidate Caches → Invalidate and Restart
2. Try again

### "App crashes on launch"

**Check Logcat in Android Studio:**
1. View → Tool Windows → Logcat
2. Filter by "pomo-flow" or "Capacitor"
3. Look for red error messages

**Common causes:**
- Missing permissions (should be fixed)
- TypeScript errors (check console)

### "Cannot connect to localhost:5546"

That's for the desktop dev server. On mobile, the app uses the built files in `android/app/src/main/assets/public/`.

To see the app:
- **Desktop browser:** `http://localhost:5546/#/today`
- **Mobile:** Just launch the app (it uses local assets)

---

## What You Can Do Now

### Test Scenarios

**Scenario 1: Morning Planning**
1. Open app
2. Tap FAB (+ button)
3. Create "Write report" for today
4. Create "Team meeting" for today
5. Create "Code review" for today
6. See all 3 tasks in Today view

**Scenario 2: Task Completion**
1. Swipe right on "Write report"
2. Feel haptic feedback
3. Task moves to completed (or disappears if "Show completed" is off)
4. Check progress bar updates

**Scenario 3: Quick Delete**
1. Swipe left on a task
2. Task should be deleted
3. Haptic feedback confirms

**Scenario 4: Offline Usage**
1. Turn off WiFi and mobile data
2. Create tasks
3. Complete tasks
4. Turn internet back on
5. Everything still works (all local)

---

## Reporting Issues

If you find bugs, note:
1. What you did (steps to reproduce)
2. What you expected
3. What actually happened
4. Screenshot if UI issue
5. Logcat output if crash

---

## Next Steps After Testing

Once you've tested the basics, we can:

1. **Fix any bugs found**
2. **Deploy sync server** (for real-time sync between devices)
3. **Implement Phase 2 features:**
   - Background sync
   - Home screen widgets
   - Push notifications
4. **Add missing features:**
   - Task detail modal
   - Pomodoro timer functionality
   - Voice-to-task
   - Camera capture

---

## Quick Reference

**Start testing:**
```bash
npx cap open android
# Then click Run in Android Studio
```

**Rebuild after code changes:**
```bash
npm run build:mobile
# Then Run again in Android Studio
```

**View logs:**
```bash
adb logcat | grep -i capacitor
```

**Navigate to Today view in browser (to compare):**
```
http://localhost:5546/#/today
```

---

**Happy Testing! 🎉**
