# Contributing to FlowState

Thanks for your interest in contributing to FlowState! This document covers everything you need to get started.

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 20+ | Runtime (see `.nvmrc`) |
| [Docker Desktop](https://docs.docker.com/get-docker/) | Latest | Runs local Supabase |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | Latest | Local Supabase management |
| [Rust](https://rustup.rs/) | stable | Only needed for Tauri desktop builds (see `rust-toolchain.toml`) |

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/user/flow-state.git
cd flow-state

# 2. Install dependencies
npm install

# 3. Start local Supabase (requires Docker)
supabase start

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local with values from `supabase start` output:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<anon key>

# Or generate keys automatically:
npm run generate:keys
# Copy the output to .env.local

# 5. Apply database migrations
supabase db reset

# 6. Start the dev server
npm run dev
# Opens at http://localhost:5546
```

**Note:** Doppler is not needed for local development. It's only used for production deployments.

### Dev Login Credentials

| Field | Value |
|-------|-------|
| Email | `dev@flowstate.local` |
| Password | `dev123` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3 + TypeScript + Vite |
| State | Pinia stores |
| UI | Tailwind CSS + Naive UI + Glass morphism |
| Canvas | Vue Flow |
| Drag & Drop | Vuedraggable |
| Rich Text | TipTap |
| Backend | Supabase (PostgreSQL + GoTrue Auth + Realtime + PostgREST) |
| Desktop | Tauri 2.x (Rust + WebView) |
| AI | Ollama (local) / Groq (cloud) |

## Code Style & Conventions

### TypeScript

- All new code must have proper TypeScript types. Avoid `any`.
- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Prefer `const` over `let`. No `var`.

### Vue Components

```vue
<script setup lang="ts">
// imports
// props / emits
// composables
// reactive state
// computed
// watchers
// functions
</script>

<template>
  <!-- template -->
</template>

<style scoped>
/* styles using design tokens */
</style>
```

### Design Tokens

Never hardcode CSS values (colors, spacing, border-radius). Always use design tokens from `src/assets/design-tokens.css`:

```css
/* Wrong */
background: rgba(18, 18, 20, 0.98);
padding: 8px 12px;

/* Right */
background: var(--overlay-component-bg);
padding: var(--space-2) var(--space-3);
```

See `docs/claude-md-extension/design-system.md` for the full token reference.

### File Organization

- **Views**: `src/views/` -- top-level route pages
- **Components**: `src/components/<domain>/` -- organized by feature domain
- **Stores**: `src/stores/` -- Pinia state management
- **Composables**: `src/composables/` -- reusable Vue 3 composables
- **Services**: `src/services/` -- external service integrations
- **Types**: `src/types/` -- TypeScript type definitions
- **Utils**: `src/utils/` -- pure utility functions

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | PascalCase | `TaskCard.vue` |
| Composables | camelCase with `use` prefix | `useTimerStore.ts` |
| Stores | camelCase | `tasks.ts`, `gamification.ts` |
| Types/Interfaces | PascalCase | `Task`, `TimerSession` |
| CSS classes | kebab-case | `task-card`, `timer-active` |

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (port 5546) |
| `npm run build` | Production build |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests with watch mode + UI |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run type-check` | TypeScript type checking |
| `npm run generate:keys` | Generate local Supabase JWT keys |
| `npm run kill` | Kill all FlowState dev processes |
| `npx tauri dev` | Run Tauri desktop in dev mode |

## Testing

### Unit Tests (Vitest)

```bash
# Run all tests
npm run test

# Run specific test file
npx vitest run src/stores/__tests__/tasks.test.ts

# Watch mode with browser UI
npm run test:watch
```

### Writing Tests

- Place test files next to the code they test, in a `__tests__/` directory
- Use the naming convention: `<filename>.test.ts`
- Use Vitest matchers and Vue Test Utils for component tests

### Playwright (E2E)

E2E tests live in `tests/` and use Playwright. Run with:

```bash
npx playwright test
```

## Architecture

For a full architecture overview, see [docs/claude-md-extension/architecture.md](docs/claude-md-extension/architecture.md).

Key architectural decisions:

- **Supabase is the persistence layer** with Row Level Security (RLS) on all tables
- **Pinia stores** manage client-side state with optimistic updates
- **Canvas sync is read-only** -- only drag handlers may change positions/parents
- **Type mappers** in `src/utils/supabaseMappers.ts` convert between app and database types
- **Offline sync** via `src/composables/sync/useSyncOrchestrator.ts` queues writes when offline

## Pull Request Process

1. **Branch from `master`**: Create a feature branch (`feature/your-feature` or `fix/your-fix`)
2. **Keep changes focused**: One PR per feature or bug fix
3. **Test your changes**: Run `npm run test` and `npm run lint` before submitting
4. **Describe what and why**: Include context in the PR description
5. **No demo data**: First-time users must see an empty app, not sample data

### Commit Messages

Use conventional commit format:

```
feat(canvas): add snap-to-grid for node positioning
fix(timer): resolve cross-device sync race condition
docs(self-hosting): add Docker setup instructions
chore: bump dependencies
```

### What to Check Before Submitting

- [ ] `npm run test` passes
- [ ] `npm run lint` passes (or `npm run lint:fix`)
- [ ] No hardcoded CSS values (use design tokens)
- [ ] No hardcoded URLs or secrets
- [ ] TypeScript types are correct (no `any`)
- [ ] New features work in both PWA and Tauri desktop modes

## Database Changes

If your change requires a database migration:

1. Create a migration file in `supabase/migrations/` with timestamp prefix:
   ```
   supabase/migrations/20260209000000_your_migration_name.sql
   ```
2. Include RLS policies for any new tables
3. Test with `supabase db reset` to verify the migration applies cleanly
4. Never run destructive commands (`DROP TABLE`, `TRUNCATE`) without explicit approval

## Questions?

- Check the [self-hosting guide](docs/SELF-HOSTING.md) for setup issues
- Read the [troubleshooting docs](docs/claude-md-extension/troubleshooting.md) for common problems
- Open an issue on GitHub for bugs or feature requests
