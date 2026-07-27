/**
 * TASK-1977 — vector: project-lane-membership-delete-atomicity [critical]
 * (evidence was MISSING).
 *
 * Deleting a lane must also detach every task that belongs to it. The
 * invariant that matters is: no task may be left referencing a lane that no
 * longer exists. deleteLane cleared task membership best-effort — each task's
 * clear was wrapped in `.catch(log)` — and then deleted the lane regardless.
 * So if even one task's detach failed, the lane was still removed and that task
 * kept a laneId pointing at a deleted lane: a dangling reference the user sees
 * as a task stuck in a phantom lane.
 *
 * Contract proved here: if any task cannot be detached, the lane deletion is
 * refused and rolled back, so no task is ever orphaned against a deleted lane.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const enqueue = vi.fn().mockResolvedValue({ id: 1 });
vi.mock("@/composables/sync/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({ enqueue }),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/stores/workspace", () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null }),
}));
vi.mock("@/utils/supabaseMappers", () => ({
  toSupabaseLane: (l: unknown) => l,
}));

const deleteLaneRemote = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/composables/useSupabaseDatabase", () => ({
  useSupabaseDatabase: () => ({
    fetchLanes: vi.fn().mockResolvedValue([]),
    saveLane: vi.fn().mockResolvedValue(undefined),
    // The store aliases this as `deleteLane: deleteLaneRemote`.
    deleteLane: deleteLaneRemote,
  }),
}));

// Fake task store: three tasks in the lane; one task's detach is set to fail.
const taskStore = vi.hoisted(() => {
  const _rawTasks: Array<{ id: string; laneId: string | null }> = [];
  const failIds = new Set<string>();
  return {
    _rawTasks,
    failIds,
    updateTask: vi.fn(async (id: string, updates: { laneId: null }) => {
      if (taskStore.failIds.has(id)) throw new Error(`sync failed for ${id}`);
      const t = _rawTasks.find((x) => x.id === id);
      if (t) t.laneId = updates.laneId;
    }),
    reset() {
      _rawTasks.length = 0;
      failIds.clear();
      this.updateTask.mockClear();
    },
  };
});
vi.mock("@/stores/tasks", () => ({ useTaskStore: () => taskStore }));

import { useLaneStore } from "@/stores/lanes";

const LANE_ID = "lane-abc";

describe("lane delete membership atomicity", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    taskStore.reset();
    enqueue.mockResolvedValue({ id: 1 });
    deleteLaneRemote.mockResolvedValue(undefined);
  });

  const seedLaneWithTasks = (store: ReturnType<typeof useLaneStore>) => {
    // Pinia setup-store: _rawLanes is exposed as the unwrapped reactive array.
    (store._rawLanes as unknown[]).push({
      id: LANE_ID,
      name: "Sprint",
      color: "#fff",
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: null,
    });
    taskStore._rawTasks.push(
      { id: "t1", laneId: LANE_ID },
      { id: "t2", laneId: LANE_ID },
      { id: "t3", laneId: LANE_ID },
    );
  };

  it("detaches every task and deletes the lane when all detaches succeed", async () => {
    const store = useLaneStore();
    seedLaneWithTasks(store);

    await store.deleteLane(LANE_ID);

    expect(taskStore._rawTasks.every((t) => t.laneId === null)).toBe(true);
    expect(store.lanes.some((l) => l.id === LANE_ID)).toBe(false);
    expect(deleteLaneRemote).toHaveBeenCalledWith(LANE_ID);
  });

  it("does NOT delete the lane if a task cannot be detached (no dangling reference)", async () => {
    const store = useLaneStore();
    seedLaneWithTasks(store);
    taskStore.failIds.add("t2"); // t2's detach will reject

    await expect(store.deleteLane(LANE_ID)).rejects.toThrow();

    // The lane must still exist, because a task still points at it.
    expect(store.lanes.some((l) => l.id === LANE_ID)).toBe(true);
    // And no task may reference a lane that was deleted out from under it.
    const danglers = taskStore._rawTasks.filter(
      (t) =>
        t.laneId === LANE_ID && !store.lanes.some((l) => l.id === t.laneId),
    );
    expect(danglers).toHaveLength(0);
    expect(deleteLaneRemote).not.toHaveBeenCalled();
  });
});
