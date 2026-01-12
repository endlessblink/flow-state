# Fix: Dead Imports (Deleted Files Still Referenced)

**Priority**: P0-CRITICAL
**Time Estimate**: 30 minutes
**Dependencies**: None

---

## Problem

7 TypeScript errors from imports referencing deleted files:

| Error | File | Line | Missing Module |
|-------|------|------|----------------|
| TS2307 | `useBackupSystem.ts` | 1 | `@/utils/integrity` |
| TS2307 | `useOptimisticUI.ts` | 9 | `@/utils/offlineQueue` |
| TS2307 | `MarkdownExportService.ts` | 2 | `./FileSystemService` |
| TS2307 | `MarkdownExportService.ts` | 6 | `jszip` |
| TS2307 | `forensicBackupLogger.ts` | 6 | `crypto-js` |
| TS2307 | `forensicBackupLogger.ts` | 9 | `./integrity` |

---

## Fixes

### Fix 1: `src/composables/useBackupSystem.ts`

**Line 1** - Remove or comment out integrity import:
```typescript
// REMOVE THIS LINE:
import { validateDataIntegrity } from '@/utils/integrity';

// If validateDataIntegrity is used, either:
// Option A: Remove all usages of validateDataIntegrity
// Option B: Create a stub function inline:
const validateDataIntegrity = (data: unknown) => ({ valid: true, errors: [] });
```

### Fix 2: `src/composables/useOptimisticUI.ts`

**Line 9** - Remove offlineQueue import:
```typescript
// REMOVE THIS LINE:
import { offlineQueue } from '@/utils/offlineQueue';

// Search for usages and either:
// Option A: Remove the functionality
// Option B: Inline a no-op stub
```

### Fix 3: `src/services/data/MarkdownExportService.ts`

**Lines 2, 6** - Remove dead imports:
```typescript
// REMOVE THESE LINES:
import { FileSystemService } from './FileSystemService';
import JSZip from 'jszip';

// If JSZip is needed, install it:
// npm install jszip @types/jszip
```

### Fix 4: `src/utils/forensicBackupLogger.ts`

**Lines 6, 9** - Remove dead imports:
```typescript
// REMOVE THESE LINES:
import CryptoJS from 'crypto-js';
import { hashData } from './integrity';

// If crypto is needed, install it:
// npm install crypto-js @types/crypto-js

// Or use built-in crypto:
import { createHash } from 'crypto';
```

---

## Verification

```bash
# After each fix, run:
npx vue-tsc --noEmit 2>&1 | grep "TS2307"

# Expected: No TS2307 errors for the fixed files
```

---

## Success Criteria

- [ ] No TS2307 errors for `@/utils/integrity`
- [ ] No TS2307 errors for `@/utils/offlineQueue`
- [ ] No TS2307 errors for `./FileSystemService`
- [ ] No TS2307 errors for `jszip` or `crypto-js`
- [ ] Application builds successfully
