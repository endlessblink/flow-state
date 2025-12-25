# SOP: Refactoring Monolithic Stores into Modular Composables

## Context
As the application grows, core stores (like `tasks.ts`) often become "God Objects" that handle state, persistence, migrations, filtering, and business logic. This leads to 2000+ line files that are difficult to maintain, test, and build.

## Refactoring Strategy

### 1. Identify Module Boundaries
Break down the store based on logical domains:
- **State Management**: The core `ref` and basic CRUD.
- **Filtering/Grouping**: Computed properties that don't modify state.
- **Migrations**: One-time data transformations.
- **External Domain**: Logic that belongs to another entity (e.g., Project logic inside a Task store).

### 2. Dependency Injection via Composables
When extracting logic into composables (e.g., `useTaskFiltering.ts`), pass the necessary state as `Ref`s. This keeps the composable generic and allows the store to remain the "Source of Truth".

```typescript
// useTaskFiltering.ts
export const useTaskFiltering = (tasks: Ref<Task[]>, activeProjectId: Ref<string | null>, ...) => {
    // Logic here
    return { filteredTasks, ... }
}
```

### 3. Solving Circular Dependencies
Large stores often depend on each other (Task store needs Project store, and vice versa).
- **The Pattern**: Use `toRef` or lazy access to avoid initialization race conditions.
- **The Fix**: In `src/stores/projects.ts`, access `useTaskStore` inside actions rather than at the top level, or use type assertions if Pinia's type inference fails during the circular loop.

### 4. Step-by-Step Execution Procedure

#### Step 4.1: Extract "Low-Hanging Fruit" Utilities
Move purely functional logic (like date formatting) to `@/utils` first. This reduces the number of imports in the main store.

#### Step 4.2: Extract Data Migrations
Move task migration logic to a dedicated composable. Ensure it is called during the store's `initializeFromPouchDB` phase.

#### Step 4.3: Extract Domain-Specific Stores
If a store is managing two different entities (e.g., Tasks and Projects), create a new store for the minor entity (`projects.ts`) and delegate actions from the main store to the new one for backward compatibility.

#### Step 4.4: Re-export for Backward Compatibility
To avoid breaking 100+ components, the "God Store" should re-export delegated actions and state.
```typescript
// src/stores/tasks.ts
const projectStore = useProjectStore()
return {
    ...taskActions,
    createProject: projectStore.createProject, // Delegated
    projects: computed(() => projectStore.projects), // Passthrough
}
```

## Common Pitfalls & Solutions

### 1. ESBuild Syntax Errors (The "Emoji" Bug)
**Symptom**: `[plugin:vite:esbuild] Expected ";" but found "❌"`
**Cause**: Some build environments/minifiers struggle with certain emoji sequences within template strings if not correctly escaped or if they break character parsing.
**Fix**: Remove the emoji or use unicode escape sequences `\u{...}` in critical log paths.

### 2. Unused Variable Accumulation
Refactoring often leaves "orphan" imports or local variables.
**Symptom**: Hundreds of lint errors.
**Fix**: Run `npm run lint` frequently. Remove `reliableSyncManager` or internal `sync` wrappers if the logic has moved to a centralized manager.

### 3. Store Initialization Order
**Issue**: The Task store might try to load tasks before the Project store has initialized its database connection.
**Fix**: Ensure `initializeFromPouchDB` in the main store awaits the initialization of its dependencies.

## Verification Checklist
- [ ] **Build Check**: Run `npm run build` to catch syntax/type errors.
- [ ] **Data Hydration**: Refresh the app and ensure local data (PouchDB + LocalStorage) is correctly loaded.
- [ ] **Undo/Redo**: Verify that `undoRedoEnabledActions` correctly delegate to the new stores.
- [ ] **Lint Cleanliness**: New files should have 0 errors; main store should have significantly fewer errors.

---
*Reference Case: "Task Store Refactor (Dec 2025)" - Successfully modularized a 2300-line tasks.ts into 3 composables and 1 new store, resolving circular dependencies and build-blocking syntax errors.*
