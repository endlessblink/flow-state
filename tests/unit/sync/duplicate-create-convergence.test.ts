/**
 * TASK-1977 — vector: duplicate-create-convergence-across-all-writers [critical]
 * (evidence was MISSING).
 *
 * Task ids are the primary key and are immutable (TASK-344). Many writers can
 * try to create "the same" task: an optimistic local create, a queue replay
 * after reconnect, a realtime echo, an AI action, the local task API. They must
 * CONVERGE on one row, never duplicate, and never resurrect a permanently
 * deleted id. safeCreateTask is the single chokepoint that enforces this, and
 * it had no unit coverage.
 *
 * Proven here against a stateful fake Supabase:
 *   - creating a brand-new id inserts exactly once ('created');
 *   - creating the same id again is a no-op that reports 'exists' (idempotent);
 *   - a tombstoned id is refused ('tombstoned') — anti-resurrection;
 *   - a concurrent insert that loses the unique-key race resolves to 'exists',
 *     not an error and not a duplicate.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types/tasks";

const state = vi.hoisted(() => ({
  tasks: new Map<
    string,
    { id: string; user_id: string; is_deleted: boolean; title: string }
  >(),
  tombstones: new Set<string>(), // `${entity_id}`
  failNextInsertWith23505: false,
}));

vi.mock("@/utils/supabaseMappers", () => ({
  toSupabaseTask: (task: Task, userId: string) => ({
    id: task.id,
    user_id: userId,
    is_deleted: false,
    title: task.title,
  }),
  fromSupabaseTask: (row: unknown) => row,
  toDbStatus: (s: unknown) => s,
}));

vi.mock("@/composables/supabase/_infrastructure", () => {
  const query = (table: string) => {
    const filters: Record<string, string> = {};
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: string) => {
        filters[col] = val;
        return builder;
      },
      maybeSingle: async () => {
        if (table === "tasks") {
          const row = state.tasks.get(filters.id);
          return { data: row ?? null, error: null };
        }
        if (table === "tombstones") {
          return {
            data: state.tombstones.has(filters.entity_id)
              ? {
                  entity_id: filters.entity_id,
                  deleted_at: "2026-06-01T00:00:00.000Z",
                }
              : null,
            error: null,
          };
        }
        return { data: null, error: null };
      },
      insert: async (payload: {
        id: string;
        user_id: string;
        title: string;
      }) => {
        if (state.failNextInsertWith23505) {
          state.failNextInsertWith23505 = false;
          return { error: { code: "23505", message: "duplicate key" } };
        }
        if (state.tasks.has(payload.id)) {
          return { error: { code: "23505", message: "duplicate key" } };
        }
        state.tasks.set(payload.id, { ...payload, is_deleted: false });
        return { error: null };
      },
    };
    return builder;
  };
  return {
    getSupabase: () => ({ from: (table: string) => query(table) }),
    invalidateCache: { tasks: vi.fn() },
    swrCache: { checkUserChange: vi.fn(), getOrFetch: vi.fn() },
  };
});

vi.mock("@/stores/tasks/taskOperations", () => ({
  UNCATEGORIZED_PROJECT_ID: "uncategorized",
}));
vi.mock("@/utils/permanentDeleteTrace", () => ({
  logPermanentDeleteTrace: vi.fn(),
}));

import { useTasksDatabase } from "@/composables/supabase/useTasksDatabase";

const USER_ID = "user-1";

function makeDb() {
  return useTasksDatabase({
    authStore: { user: { id: USER_ID }, isAuthenticated: true } as never,
    isSyncing: { value: false } as never,
    lastSyncError: { value: null } as never,
    getUserIdSafe: () => USER_ID,
    withRetry: async (fn: () => unknown) => fn(),
    handleError: (e: unknown) => {
      throw e;
    },
  } as never);
}

const task = (id: string, title = `Task ${id}`): Task =>
  ({ id, title, status: "todo", projectId: "p1", subtasks: [] }) as Task;

describe("duplicate-create convergence (safeCreateTask)", () => {
  beforeEach(() => {
    state.tasks.clear();
    state.tombstones.clear();
    state.failNextInsertWith23505 = false;
  });

  it("creates a brand-new id exactly once", async () => {
    const db = makeDb();
    const result = await db.safeCreateTask(task("t1"));
    expect(result.status).toBe("created");
    expect(state.tasks.size).toBe(1);
  });

  it("is idempotent — a second create of the same id reports exists and adds no row", async () => {
    const db = makeDb();
    await db.safeCreateTask(task("t1"));
    const second = await db.safeCreateTask(task("t1"));
    expect(second.status).toBe("exists");
    expect(state.tasks.size).toBe(1);
  });

  it("refuses to resurrect a permanently deleted (tombstoned) id", async () => {
    state.tombstones.add("gone");
    const db = makeDb();
    const result = await db.safeCreateTask(task("gone"));
    expect(result.status).toBe("tombstoned");
    expect(state.tasks.has("gone")).toBe(false);
  });

  it("resolves a lost unique-key race to exists, not an error or a duplicate", async () => {
    const db = makeDb();
    // The pre-insert existence check passes (row not yet visible), then the
    // insert loses the race and the DB rejects it with 23505.
    state.failNextInsertWith23505 = true;
    const result = await db.safeCreateTask(task("raced"));
    expect(result.status).toBe("exists");
    expect(state.tasks.size).toBe(0); // our insert did not land; the winner's did
  });

  it("converges N concurrent-style creates of one id onto a single row", async () => {
    const db = makeDb();
    const results = await Promise.all([
      db.safeCreateTask(task("shared")),
      db.safeCreateTask(task("shared")),
      db.safeCreateTask(task("shared")),
    ]);
    const created = results.filter((r) => r.status === "created");
    const exists = results.filter((r) => r.status === "exists");
    expect(created).toHaveLength(1);
    expect(exists).toHaveLength(2);
    expect(state.tasks.size).toBe(1);
  });
});
