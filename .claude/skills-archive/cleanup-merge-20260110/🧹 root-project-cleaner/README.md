# Root Project Cleaner - Pomo-Flow

Simple, focused cleanup for Pomo-Flow Vue.js project. Removes temporary files, build artifacts, and development clutter that accumulates during development.

## 🚀 Quick Start

```javascript
import rootCleaner from '.claude/skills/root-project-cleaner/index.js';

// Preview what would be cleaned
await rootCleaner.clean({ dryRun: true });

// Clean test files cluttering the root
await rootCleaner.cleanTests();

// Clean build artifacts
await rootCleaner.cleanBuilds();

// Clean everything
await rootCleaner.cleanAll();
```

## 📋 What It Cleans

### Test Files (Biggest Problem Area)
- `test-*.js`, `test-*.cjs`, `test-*.mjs` - Test scripts
- `test-*.html`, `test-*.json` - Test output files
- `debug-*.js`, `fix-*.mjs` - Debug scripts
- `check-*.mjs`, `run-*.mjs` - Utility scripts
- `investigate-*.mjs`, `quick-*.mjs` - Analysis scripts
- `test-results/` directory
- `firebase-debug.log`

### Build Artifacts
- `dist/` - Vite build output
- `storybook-static/` - Storybook build
- `android/`, `ios/` - Mobile builds
- `*.apk`, `*.ipa` - Mobile packages

### Cache Files
- `node_modules/.cache/` - Node cache
- `.vite/` - Vite cache
- `*.tsbuildinfo` - TypeScript build info
- `.eslintcache` - ESLint cache

### Development Clutter
- `*-backup.html`, `*-debug.html` - Temporary HTML files
- `current-ui-state.png`, `calendar-debug.png` - Debug screenshots
- `*.sqlite` files - Temporary databases

## 🛡️ Safety Features

- **Always defaults to dry-run mode** - Preview before deleting
- **Git awareness** - Warns about uncommitted changes
- **Smart skip list** - Never deletes important files like:
  - Source code (`src/`, `public/`, `scripts/`)
  - Config files (`package.json`, `vite.config.js`)
  - Documentation (`README.md`, `CLAUDE.md`)
  - Project directories (`.git/`, `.claude/`, `node_modules/`)

## 🎯 Usage Examples

### Preview Mode (Recommended First)
```javascript
// See what would be deleted without actually deleting
const result = await rootCleaner.clean({ dryRun: true });
console.log(`Found ${result.deleted} files to delete`);
```

### Clean Specific Types
```javascript
// Only clean test files (most common need)
await rootCleaner.cleanTests();

// Only clean build artifacts
await rootCleaner.cleanBuilds();

// Only clean cache files
await rootCleaner.cleanCache();

// Only clean development clutter
await rootCleaner.cleanDev();
```

### Clean Everything
```javascript
// Clean all categories
await rootCleaner.cleanAll();
```

### Custom Cleanup
```javascript
// Clean specific type with options
await rootCleaner.clean({
  type: 'tests',
  dryRun: false,
  verbose: true
});
```

## 🔧 Integration with npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "clean:tests": "node -e \"import('.claude/skills/root-project-cleaner/index.js').then(m => m.default.cleanTests())\"",
    "clean:builds": "node -e \"import('.claude/skills/root-project-cleaner/index.js').then(m => m.default.cleanBuilds())\"",
    "clean:cache": "node -e \"import('.claude/skills/root-project-cleaner/index.js').then(m => m.default.cleanCache())\"",
    "clean:all": "node -e \"import('.claude/skills/root-project-cleaner/index.js').then(m => m.default.cleanAll())\"",
    "clean:preview": "node -e \"import('.claude/skills/root-project-cleaner/index.js').then(m => m.default.clean({dryRun: true}))\""
  }
}
```

Then use:
```bash
npm run clean:preview  # See what would be cleaned
npm run clean:tests    # Clean test files
npm run clean:all      # Clean everything
```

## 📊 Sample Output

```
🧹 Pomo-Flow Root Cleaner (DRY RUN)

📋 Files to potentially delete (15 files, 2.3 MB):

📂 Test file (8 files, 1.1 MB):
   test-calendar-debug.js (245.1 KB)
   test-filtered-tasks-fix.mjs (89.2 KB)
   calendar-drag-test-log.json (456.7 KB)
   ...

📂 Debug file (3 files, 890.2 KB):
   debug-calendar-drag.js (234.1 KB)
   deep-investigate.mjs (656.1 KB)
   ...

📂 Development file (4 files, 320.7 KB):
   current-ui-state.png (156.3 KB)
   calendar-debug.png (164.4 KB)

Would delete 15 files (2.3 MB)
```

## ⚠️ Important Notes

1. **Always preview first** - Use dry-run mode to see what will be deleted
2. **Check git status** - Commit or stash changes before cleanup
3. **Test files are the main problem** - This tool focuses on cleaning up the test file clutter in your root directory
4. **Safe by default** - The tool is designed to never delete important project files

## 🎯 Why This Exists

Your Pomo-Flow project accumulates many temporary files during development:
- Test scripts and output files
- Debug and investigation scripts
- Build artifacts and cache files
- Temporary HTML and image files

This tool provides a quick, safe way to clean up the clutter without risking your important project files.

---

**Made specifically for Pomo-Flow Vue.js project**