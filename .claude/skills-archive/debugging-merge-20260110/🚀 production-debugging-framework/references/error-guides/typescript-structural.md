# TypeScript Structural Error Protocol

## Overview

Systematic approach to resolving TypeScript structural errors (TS2339, TS2345, TS2322, TS7005, TS7006) that form the foundation of type safety in Vue 3 applications.

## When to Use This Protocol

**Trigger Errors:**
- TS2339: Property does not exist on type
- TS2345: Argument is not assignable to parameter
- TS2322: Type is not assignable to type
- TS7005: Variable implicitly has 'any' type
- TS7006: Parameter implicitly has 'any' type
- Missing interface properties
- Type mismatch errors

## Immediate Actions

### 1. Stop and Assess
- **DO NOT** fix individual errors in isolation
- **IDENTIFY** if this is a cascading failure (>10 errors)
- **ACTIVATE** ts-foundation-restorer skill if cascading

### 2. Foundation-First Approach
- **ALWAYS** fix interfaces/types before implementations
- **NEVER** use type assertions (`as any`) as first resort
- **SYSTEMATICALLY** update ALL affected locations

## Systematic Resolution Process

### Phase 1: Error Analysis

#### Identify Root Pattern
1. **Single Property Missing**: One interface property absent
2. **Type Mismatch**: Wrong type assigned to property
3. **Missing Interface**: Entire interface definition missing
4. **Generic Constraint**: Generic type parameters incorrect
5. **Module Declaration**: Missing module type definitions

#### Classification
```
CATEGORIZE:
□ Single Interface Update (1-5 errors)
□ Multiple Interface Updates (5-20 errors)
□ Cascading Foundation Failure (20+ errors)
□ Generic Type System Issue
□ Module Resolution Problem
```

### Phase 2: Interface Foundation Repair

#### Single Interface Updates
1. **Read Complete File**: Get full context of the interface
2. **Cross-Reference Usage**: Find all locations using the interface
3. **Update Interface**: Add missing properties with correct types
4. **Update Implementations**: Fix all usage locations
5. **Validate**: Run `npm run typecheck`

#### Multiple Interface Updates
1. **Interface Audit**: List all affected interfaces
2. **Dependency Mapping**: Identify interface relationships
3. **Systematic Update**: Update interfaces in dependency order
4. **Implementation Sync**: Update all implementations
5. **Validation Loop**: Run typecheck after each interface

#### Cascading Foundation Failure
1. **ACTIVATE TS-FOUNDATION-RESTORER** immediately
2. **Foundation Analysis**: Identify core interface problems
3. **Systematic Restore**: Follow foundation restorer protocol
4. **Validation**: Complete type system integrity check

### Phase 3: Generic Type System

#### Generic Constraint Issues
```typescript
// PROBLEM: Generic constraint too loose
interface Store<T> {
  items: T[]
  addItem(item: T): void
  getItem(id: string): T | undefined  // Error: id doesn't exist in T
}

// SOLUTION: Constrain generic to required shape
interface Identifiable {
  id: string
}

interface Store<T extends Identifiable> {
  items: T[]
  addItem(item: T): void
  getItem(id: string): T | undefined  // Now works
}
```

#### Generic Type Parameters
```typescript
// PROBLEM: Missing generic constraints
function process<T>(data: T): T {
  return data.id // Error: Property 'id' does not exist on 'T'
}

// SOLUTION: Add proper constraints
interface Identifiable {
  id: string
}

function process<T extends Identifiable>(data: T): T {
  return data // Now works with proper constraint
}
```

### Phase 4: Module Declaration Issues

#### Missing Module Types
```typescript
// PROBLEM: Missing module declaration
import VueFlow from '@vue-flow/core'
// Error: Could not find a declaration file for module '@vue-flow/core'

// SOLUTION: Add module declaration
declare module '@vue-flow/core' {
  export interface VueFlow {}
}
```

#### Augmenting Existing Modules
```typescript
// PROBLEM: Missing property in existing module
declare module 'vue' {
  interface ComponentCustomProperties {
    $filters: FilterDefinitions
  }
}
```

## Common Patterns and Solutions

### Pattern 1: Missing Interface Property
```typescript
// ERROR: TS2339: Property 'completedAt' does not exist on type 'Task'
interface Task {
  id: string
  title: string
  status: 'planned' | 'in_progress' | 'done'
}

// SOLUTION: Add missing property to interface
interface Task {
  id: string
  title: string
  status: 'planned' | 'in_progress' | 'done'
  completedAt?: Date  // Optional property
}
```

### Pattern 2: Type Mismatch
```typescript
// ERROR: TS2322: Type 'string' is not assignable to type 'TaskStatus'
const status: TaskStatus = 'completed'  // Error

// SOLUTION: Update type or value
type TaskStatus = 'planned' | 'in_progress' | 'done' | 'completed'
// OR
const status: TaskStatus = 'done'
```

### Pattern 3: Generic Store Issues
```typescript
// ERROR: TS7006: Parameter 'task' implicitly has 'any' type
const addTask = (task) => {  // Error
  tasks.value.push(task)
}

// SOLUTION: Add proper typing
interface Task {
  id: string
  title: string
}

const addTask = (task: Task) => {
  tasks.value.push(task)
}
```

## Integration with Vue 3 + Pinia

### Store Type Definitions
```typescript
// PROPER STORE TYPING
interface TaskState {
  tasks: Ref<Task[]>
  activeTasks: ComputedRef<Task[]>
  createTask: (taskData: Partial<Task>) => Promise<Task>
}

export const useTaskStore = defineStore('tasks', (): TaskState => {
  const tasks = ref<Task[]>([])

  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status !== 'done')
  )

  const createTask = async (taskData: Partial<Task>): Promise<Task> => {
    // Implementation
  }

  return {
    tasks,
    activeTasks,
    createTask
  }
})
```

### Component Props Typing
```typescript
// PROPER PROP TYPING
interface Props {
  task: Task
  variant?: 'default' | 'compact'
  onEdit?: (task: Task) => void
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  onEdit: undefined
})
```

## Validation Commands

### TypeScript Compilation
```bash
# Full type check
npm run typecheck

# Watch mode for continuous checking
npx tsc --noEmit --watch

# Check specific file
npx tsc --noEmit src/components/TaskCard.vue
```

### Incremental Fixes
```bash
# After each interface update
npm run typecheck

# Quick syntax check
npx tsc --noEmit --skipLibCheck

# Strict mode check
npx tsc --noEmit --strict
```

## Documentation Requirements

### Before Fixing
- List all TypeScript errors with file:line references
- Identify error patterns (single property vs cascading)
- Note recent changes that may have caused issues
- Document current working state

### After Fixing
- Record interface changes made
- List all files affected by updates
- Document validation commands used
- Note any prevention strategies

### Knowledge Transfer
- Update interface documentation
- Record common patterns for team reference
- Note any generic type system improvements
- Document module declaration additions

## Prevention Strategies

### Interface Design
- **Complete Definitions**: Include all likely properties upfront
- **Optional Properties**: Use `?` for non-required fields
- **Union Types**: Use discriminated unions for variant types
- **Generic Constraints**: Properly constrain generic types

### Development Workflow
- **Type-First Development**: Define interfaces before implementations
- **Incremental Validation**: Run typecheck after each interface change
- **Consistent Patterns**: Use consistent typing patterns across stores
- **Documentation**: Keep interface documentation current

### Code Review Focus
- **Interface Completeness**: All properties properly typed
- **Generic Usage**: Proper generic constraints and type parameters
- **Module Declarations**: Complete module type definitions
- **Consistency**: Consistent typing patterns across codebase

---

**This protocol ensures systematic, foundation-first resolution of TypeScript structural errors with zero tolerance for type system compromises.**