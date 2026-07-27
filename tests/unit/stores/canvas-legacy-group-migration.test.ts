/**
 * TASK-1977 / TASK-1871: legacy day-column groups must migrate to real UUIDs
 * and become syncable.
 *
 * Background: `toSupabaseGroup` refuses to persist a non-UUID group id, so
 * day-columns created with legacy ids ("Monday") were silently never saved to
 * Supabase — every device kept a local-only copy that drifted with no way to
 * reconcile. `migrateLegacyGroupIds` re-mints them under a deterministic UUID
 * derived from the day keyword + user id, so every device converges on one row.
 *
 * This vector previously had E2E-only evidence (canvas-sync-regressions R7),
 * and that spec runs serial — when it fails it takes the rest of the file's
 * sync regressions down with it. These deterministic checks pin the migration
 * contract without a browser.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasGroup } from "@/types/canvas";

vi.mock("@/services/offline/readCacheDB", () => ({
  cacheGroups: vi.fn(),
}));
vi.mock("@/utils/sync/writeRateGuard", () => ({
  recordWrite: vi.fn(),
}));
const { mockEnqueue } = vi.hoisted(() => ({
  mockEnqueue: vi.fn().mockResolvedValue({ id: 1 }),
}));
vi.mock("@/composables/sync/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({ enqueue: mockEnqueue }),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: USER_ID } }),
}));
// Mirror the real mapper's defining behaviour: it refuses non-UUID group ids.
// That refusal is the whole reason the migration exists, so the test must keep
// it rather than stub it away.
vi.mock("@/utils/supabaseMappers", () => ({
  toSupabaseGroup: vi.fn((g: CanvasGroup) =>
    UUID_RE.test(g.id) ? { id: g.id, name: g.name } : null,
  ),
}));
vi.mock("@/stores/tasks", () => ({
  useTaskStore: () => mockTaskStore,
}));

const USER_ID = "5f6c1f1e-2f37-4a5f-9a3a-0f3b9d3f1a11";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mockUpdateTask = vi.fn().mockResolvedValue(undefined);
const mockTaskStore = {
  rawTasks: [] as Array<{ id: string; parentId: string | null }>,
  updateTask: mockUpdateTask,
};

import { useCanvasGroups } from "@/stores/canvas/canvasGroups";
import { deterministicGroupId } from "@/utils/canvas/legacyGroupId";

const mockSaveGroupToStorage = vi.fn().mockResolvedValue(undefined);
const mockSaveGroupsToLocalStorage = vi.fn();

function makeModule() {
  return useCanvasGroups(
    {
      saveGroupToStorage: mockSaveGroupToStorage,
      saveGroupsToLocalStorage: mockSaveGroupsToLocalStorage,
      deleteGroupRemote: vi.fn().mockResolvedValue(undefined),
    },
    { value: { tasks: [] as never[] } },
  );
}

function legacyGroup(id: string, name: string): CanvasGroup {
  return {
    id,
    name,
    type: "custom",
    color: "#4ECDC4",
    position: { x: 5000, y: 5000, width: 800, height: 600 },
    layout: "freeform",
    isVisible: true,
  } as unknown as CanvasGroup;
}

describe("legacy day-group id migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueue.mockResolvedValue({ id: 1 });
    mockTaskStore.rawTasks = [];
    localStorage.clear();
  });

  it("re-mints a legacy day-column under a UUID and drops the unsyncable copy", async () => {
    const groups = makeModule();
    groups.setGroups([legacyGroup("legacy-monday-3", "Monday")]);

    const result = await groups.migrateLegacyGroupIds(USER_ID);

    expect(result.migrated).toBe(1);
    const monday = groups._rawGroups.value.filter((g) => g.name === "Monday");
    expect(monday).toHaveLength(1);
    expect(UUID_RE.test(monday[0].id)).toBe(true);
    expect(
      groups._rawGroups.value.some((g) => g.id === "legacy-monday-3"),
    ).toBe(false);
  });

  it("makes the migrated group reach the sync queue — the point of the migration", async () => {
    const groups = makeModule();
    groups.setGroups([legacyGroup("legacy-monday-3", "Monday")]);

    await groups.migrateLegacyGroupIds(USER_ID);

    const groupCreates = mockEnqueue.mock.calls
      .map(([op]) => op)
      .filter((op) => op.entityType === "group" && op.operation === "create");
    expect(groupCreates).toHaveLength(1);
    expect(UUID_RE.test(groupCreates[0].entityId)).toBe(true);
  });

  it("still ensures the remote row when the UUID copy already exists locally", async () => {
    // The migration skips creating the UUID group when one is already present
    // locally. "Present locally" does not mean "present in Supabase" — the copy
    // may itself be a local-only group whose earlier write never landed. In
    // that case the migration deleted the legacy copy, enqueued nothing, and
    // still reported success: the user is left with a group that exists on this
    // device only, and the migration claims it was migrated. Reporting success
    // without a successful operation is the exact pattern TASK-1977 exists to
    // remove, so the surviving group must be pushed to the queue.
    const groups = makeModule();
    const existingUuidId = deterministicGroupId(USER_ID, {
      id: "legacy-monday-3",
      name: "Monday",
    });
    const localOnlyCopy = legacyGroup("legacy-monday-3", "Monday");
    groups.setGroups([
      localOnlyCopy,
      { ...localOnlyCopy, id: existingUuidId } as CanvasGroup,
    ]);

    const result = await groups.migrateLegacyGroupIds(USER_ID);

    expect(result.migrated).toBe(1);
    const enqueuedIds = mockEnqueue.mock.calls
      .map(([op]) => op)
      .filter((op) => op.entityType === "group")
      .map((op) => op.entityId);
    expect(enqueuedIds).toContain(existingUuidId);
  });

  it('derives the same id on every device so two "Monday" copies converge', async () => {
    const deviceA = makeModule();
    deviceA.setGroups([legacyGroup("legacy-monday-3", "Monday")]);
    await deviceA.migrateLegacyGroupIds(USER_ID);

    const deviceB = makeModule();
    deviceB.setGroups([legacyGroup("monday-column-old", "Monday")]);
    await deviceB.migrateLegacyGroupIds(USER_ID);

    const idA = deviceA._rawGroups.value.find((g) => g.name === "Monday")!.id;
    const idB = deviceB._rawGroups.value.find((g) => g.name === "Monday")!.id;
    expect(idA).toBe(idB);
  });

  it("re-points tasks parented to the legacy id so they are not orphaned", async () => {
    const groups = makeModule();
    groups.setGroups([legacyGroup("legacy-monday-3", "Monday")]);
    mockTaskStore.rawTasks = [
      { id: "task-in-monday", parentId: "legacy-monday-3" },
      { id: "task-elsewhere", parentId: null },
    ];

    await groups.migrateLegacyGroupIds(USER_ID);

    const newId = groups._rawGroups.value.find((g) => g.name === "Monday")!.id;
    expect(mockUpdateTask).toHaveBeenCalledWith(
      "task-in-monday",
      { parentId: newId },
      "DRAG",
    );
    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
  });

  it("leaves non-day legacy groups alone so cleanup junk is not resurrected", async () => {
    const groups = makeModule();
    groups.setGroups([
      legacyGroup("legacy-done", "Done"),
      legacyGroup("legacy-1", "1"),
    ]);

    const result = await groups.migrateLegacyGroupIds(USER_ID);

    expect(result.migrated).toBe(0);
    expect(groups._rawGroups.value.map((g) => g.id).sort()).toEqual([
      "legacy-1",
      "legacy-done",
    ]);
  });

  it("is idempotent — a second run has nothing left to migrate", async () => {
    const groups = makeModule();
    groups.setGroups([legacyGroup("legacy-monday-3", "Monday")]);

    await groups.migrateLegacyGroupIds(USER_ID);
    const afterFirst = groups._rawGroups.value.map((g) => g.id).sort();
    const second = await groups.migrateLegacyGroupIds(USER_ID);

    expect(second.migrated).toBe(0);
    expect(groups._rawGroups.value.map((g) => g.id).sort()).toEqual(afterFirst);
  });
});
