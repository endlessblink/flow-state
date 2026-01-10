# Import/Module Resolution Error Protocol

## Overview

Systematic approach to resolving module import errors, path resolution issues, and barrel export problems in Vue 3 + Vite applications.

## When to Use This Protocol

**Trigger Errors:**
- "Module not found" errors
- "Cannot resolve module" issues
- Import path resolution failures
- Barrel export inconsistencies
- Vite build import errors
- TypeScript import resolution issues

## Immediate Actions

### 1. Error Classification
```
CLASSIFY IMPORT ERROR:
□ File Path Error (incorrect path)
□ Missing File (file doesn't exist)
□ Barrel Export Issue (index.ts problem)
□ Alias Resolution (@/ prefix issue)
□ Node Module Resolution (dependency issue)
□ TypeScript Module Declaration
```

### 2. Validation Commands
```bash
# Primary validation
npm run validate:imports

# Build-time import check
npm run build

# Development server import check
npm run dev --force
```

## Systematic Resolution Process

### Phase 1: Path Verification

#### File Path Analysis
1. **Verify File Existence**: Check if imported file actually exists
2. **Case Sensitivity**: Ensure correct case (Linux is case-sensitive)
3. **Path Accuracy**: Verify complete path from source location
4. **File Extensions**: Confirm correct file extensions (.vue, .ts, .js)

#### Path Resolution Commands
```bash
# Check if file exists
ls -la src/components/TaskCard.vue

# Find correct file path
find src/ -name "TaskCard.vue"

# Check case sensitivity
ls -la src/components/ | grep -i taskcard
```

### Phase 2: Barrel Export Issues

#### Index File Problems
```typescript
// PROBLEM: Missing export in index.ts
// src/stores/index.ts
export { useTaskStore } from './tasks'
// Missing: useCanvasStore export

// SOLUTION: Add missing export
export { useTaskStore } from './tasks'
export { useCanvasStore } from './canvas'
export { useTimerStore } from './timer'
export { useUIStore } from './ui'
```

#### Re-export Consistency
```typescript
// PROBLEM: Inconsistent re-export naming
// src/components/base/index.ts
export { default as Button } from './Button.vue'
export { default as Modal } from './Modal.vue'
// Missing other components

// SOLUTION: Complete re-exports
export { default as Button } from './Button.vue'
export { default as Modal } from './Modal.vue'
export { default as Card } from './Card.vue'
export { default as Input } from './Input.vue'
```

### Phase 3: Alias Resolution

#### Vite Configuration Issues
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
    }
  }
})
```

#### TypeScript Path Mapping
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@stores/*": ["./src/stores/*"]
    }
  }
}
```

### Phase 4: Vue Component Imports

#### Component Registration Issues
```typescript
// PROBLEM: Incorrect component import
import TaskCard from '@/components/TaskCard'  // Missing .vue extension
import { SomeComponent } from '@/components/SomeComponent'  // Wrong import type

// SOLUTION: Correct component imports
import TaskCard from '@/components/TaskCard.vue'
import SomeComponent from '@/components/SomeComponent.vue'

// OR for barrel exports
import { TaskCard, SomeComponent } from '@/components'
```

#### Dynamic Imports
```typescript
// PROBLEM: Dynamic import path resolution
const TaskCard = defineAsyncComponent(() => import('@/components/TaskCard'))

// SOLUTION: Ensure correct path resolution
const TaskCard = defineAsyncComponent(() => import('@/components/TaskCard.vue'))
```

## Common Import Patterns and Solutions

### Pattern 1: Relative Path Issues
```typescript
// PROBLEM: Incorrect relative path
import TaskStore from '../../../stores/tasks'  // Too many ../

// SOLUTION: Use alias or correct relative path
import { useTaskStore } from '@/stores/tasks'
// OR
import { useTaskStore } from '../stores/tasks'
```

### Pattern 2: Barrel Export Inconsistency
```typescript
// PROBLEM: Component exists but not exported
// src/components/base/Button.vue exists
// src/components/base/index.ts
export { default as Modal } from './Modal.vue'
// Missing Button export

// SOLUTION: Add missing export
export { default as Button } from './Button.vue'
export { default as Modal } from './Modal.vue'
```

### Pattern 3: File Extension Issues
```typescript
// PROBLEM: Missing file extension
import TaskCard from '@/components/TaskCard'  // Vite needs .vue

// SOLUTION: Include file extension
import TaskCard from '@/components/TaskCard.vue'

// OR configure Vite to resolve extensions
export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json']
  }
})
```

## Vue 3 Specific Import Issues

### Composition API Imports
```typescript
// PROBLEM: Missing Vue 3 imports
import { ref, computed } from 'vue'  // Missing onMounted
import { useRouter } from 'vue-router'  // Correct

// SOLUTION: Complete Vue imports
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
```

### Pinia Store Imports
```typescript
// PROBLEM: Incorrect store import
import useTaskStore from '@/stores/tasks'  // Default export issue

// SOLUTION: Correct named import
import { useTaskStore } from '@/stores/tasks'

// OR with barrel export
import { useTaskStore } from '@/stores'
```

### Vue Router Imports
```typescript
// PROBLEM: Incorrect router import
import router from '@/router'  // May not work

// SOLUTION: Use useRouter composable
import { useRouter } from 'vue-router'

// OR import router instance for route definitions
import router from '@/router'
```

## Validation and Testing

### Import Validation Script
```bash
#!/bin/bash
# validate-imports.sh

echo "🔍 Validating imports..."

# Check for missing files
echo "Checking file existence..."
find src/ -name "*.vue" -o -name "*.ts" | while read file; do
  grep -E "import.*from\s+['\"]@/" "$file" | while read import_line; do
    path=$(echo "$import_line" | sed -E "s/.*from\s+['\"]@\/([^'\"]*)['\"].*/\1/")
    if [ ! -f "src/$path" ] && [ ! -f "src/$path.ts" ] && [ ! -f "src/$path.vue" ]; then
      echo "❌ Missing file: src/$path (referenced in $file)"
    fi
  done
done

# Check barrel exports
echo "Checking barrel exports..."
for index_file in $(find src/ -name "index.ts"); do
  dir=$(dirname "$index_file")
  find "$dir" -maxdepth 1 -name "*.vue" | while read vue_file; do
    basename=$(basename "$vue_file" .vue)
    if ! grep -q "$basename" "$index_file"; then
      echo "⚠️  $vue_file not exported in $index_file"
    fi
  done
done

echo "✅ Import validation complete"
```

### Build-Time Import Check
```bash
# Test build to catch import issues
npm run build

# Development build with import optimization
npm run build --mode development

# Vite dependency optimization
npm run dev --force
```

## Prevention Strategies

### File Organization
- **Consistent Structure**: Maintain predictable file organization
- **Barrel Exports**: Keep index.ts files current
- **Naming Conventions**: Use consistent component/file naming
- **Path Aliases**: Use @/ alias consistently

### Development Workflow
- **Import Validation**: Run `npm run validate:imports` regularly
- **Build Testing**: Test builds frequently to catch issues early
- **IDE Integration**: Use IDE import validation features
- **Pre-commit Hooks**: Add import validation to git hooks

### Barrel Export Management
```typescript
// src/components/index.ts - Complete barrel export
export { default as TaskCard } from './TaskCard.vue'
export { default as TaskList } from './TaskList.vue'
export { default as TaskForm } from './TaskForm.vue'
export { default as BoardView } from './views/BoardView.vue'
export { default as CanvasView } from './views/CanvasView.vue'
export { default as CalendarView } from './views/CalendarView.vue'

// Base components
export * from './base'
```

### Automated Barrel Export Generation
```bash
# Generate barrel exports automatically
find src/components -name "*.vue" | sed 's/src\/components\///; s/\.vue$//' | while read component; do
  echo "export { default as $component } from './$component.vue'"
done > src/components/index.ts
```

## Documentation Requirements

### Before Fixing
- List all import errors with file:line references
- Document attempted imports and actual file paths
- Note any recent file moves or renames
- Record Vite/Vue version changes

### After Fixing
- Document path corrections made
- List barrel exports added/updated
- Record validation commands used
- Note any alias configuration changes

### Knowledge Transfer
- Update file organization documentation
- Record import pattern guidelines
- Document barrel export maintenance procedures
- Note IDE configuration recommendations

---

**This protocol ensures systematic resolution of import and module resolution issues with complete validation and prevention strategies.**