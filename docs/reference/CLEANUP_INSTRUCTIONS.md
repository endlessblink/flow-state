# Demo Task Cleanup Instructions

## Problem
Demo tasks like "create project structure", "Feature development", "Design database schema", "Write Readme" are appearing in your calendar but don't exist in the source code. These are stored in persistent storage from previous test runs.

## Solution
Use the cleanup script to remove all demo tasks and start fresh.

## Steps

### 1. Run the Cleanup Script
1. Make sure your pomo-flow app is running: `npm run dev`
2. Open: `http://localhost:5546/clear-all-data.html`
3. Click **"Analyze Only (Safe)"** first to see what data exists
4. Then click **"Clear ALL Data"** to remove all demo tasks

### 2. Verify Results
1. Refresh the main app: `http://localhost:5173`
2. Check that demo tasks are gone from calendar inbox
3. Verify your real 27 tasks appear correctly
4. Test creating new tasks works properly

## What Gets Cleared
- All IndexedDB data (tasks, projects, canvas, timer, settings)
- All localStorage entries with `pomo-flow` prefix
- All sessionStorage entries with `pomo-flow` prefix

## What Happens After
- App starts fresh with default project
- Recovery tool functionality is restored
- New tasks you create will persist properly
- No more hardcoded demo tasks

## If Issues Persist
If demo tasks still appear after cleanup:
1. Check browser dev tools → Application → Storage
2. Manually clear any remaining `pomo-flow` entries
3. Restart browser completely