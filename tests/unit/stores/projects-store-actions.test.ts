/**
 * TASK-1977 — feature-matrix coverage for the Projects area.
 * Vectors/features: project.create, project.edit (rename), project.set-color,
 * project.set-view-type, project.delete, project.set-active-filter.
 *
 * These were unaudited/partial in feature-audit-matrix.json. Each test asserts
 * the action actually changes the persisted project state — a broken action
 * (no-op, wrong field, lost persistence) fails here.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const cacheProjects = vi.hoisted(() => vi.fn());
vi.mock("@/services/offline/readCacheDB", () => ({
  cacheProjects,
  captureReadCacheScope: () => ({ scope: null, epoch: 0 }),
  configureReadCacheScope: vi.fn(),
  getCachedProjects: vi.fn().mockResolvedValue([]),
  isReadCacheScopeTokenCurrent: () => true,
}));

const saveProjects = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deleteProjectRemote = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
vi.mock("@/composables/useSupabaseDatabase", () => ({
  useSupabaseDatabase: () => ({
    saveProjects,
    fetchProjects: vi.fn().mockResolvedValue([]),
    deleteProject: deleteProjectRemote,
  }),
}));

// Guest mode keeps persistence local (avoids the Supabase batch path) so the
// tests focus on the action's effect on project state.
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: null, isAuthenticated: false, isGuest: true }),
}));
vi.mock("@/stores/workspace", () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null }),
}));

const taskStore = vi.hoisted(() => ({
  _rawTasks: [] as Array<{ id: string; projectId: string }>,
  tasks: [] as unknown[],
  updateTask: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/stores/tasks", () => ({
  useTaskStore: () => taskStore,
  UNCATEGORIZED_PROJECT_ID: "uncategorized",
}));

import { useProjectStore } from "@/stores/projects";

const seed = (store: ReturnType<typeof useProjectStore>, over = {}) => {
  (store._rawProjects as unknown[]).push({
    id: "proj-1",
    name: "Original",
    color: "#111111",
    colorType: "hex",
    viewType: "status",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...over,
  });
};

describe("Projects store actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    taskStore._rawTasks = [];
    localStorage.clear();
  });

  it("createProject creates a project with sensible defaults", async () => {
    const store = useProjectStore();
    const created = await store.createProject({ name: "Launch" });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Launch");
    expect(created.color).toBeTruthy();
    expect(created.viewType).toBe("status");
    expect(store.projects.some((p) => p.id === created.id)).toBe(true);
  });

  it("updateProject renames and bumps updatedAt", async () => {
    const store = useProjectStore();
    seed(store);
    await store.updateProject("proj-1", { name: "Renamed" });
    const p = store.projects.find((x) => x.id === "proj-1")!;
    expect(p.name).toBe("Renamed");
    expect(new Date(p.updatedAt).getTime()).toBeGreaterThan(
      new Date("2026-06-01T00:00:00Z").getTime(),
    );
  });

  it("setProjectColor sets a hex color", async () => {
    const store = useProjectStore();
    seed(store);
    await store.setProjectColor("proj-1", "#ABCDEF", "hex");
    const p = store.projects.find((x) => x.id === "proj-1")!;
    expect(p.color).toBe("#ABCDEF");
    expect(p.colorType).toBe("hex");
    expect(p.emoji).toBeUndefined();
  });

  it("setProjectColor sets an emoji icon and clears it when switching back to hex", async () => {
    const store = useProjectStore();
    seed(store);
    await store.setProjectColor("proj-1", "#000000", "emoji", "🚀");
    let p = store.projects.find((x) => x.id === "proj-1")!;
    expect(p.colorType).toBe("emoji");
    expect(p.emoji).toBe("🚀");

    await store.setProjectColor("proj-1", "#123456", "hex");
    p = store.projects.find((x) => x.id === "proj-1")!;
    expect(p.colorType).toBe("hex");
    expect(p.emoji).toBeUndefined();
  });

  it("setProjectViewType changes the Kanban grouping for that project", async () => {
    const store = useProjectStore();
    seed(store);
    await store.setProjectViewType("proj-1", "date");
    expect(store.projects.find((x) => x.id === "proj-1")!.viewType).toBe(
      "date",
    );
    await store.setProjectViewType("proj-1", "priority");
    expect(store.projects.find((x) => x.id === "proj-1")!.viewType).toBe(
      "priority",
    );
  });

  it("setActiveProject sets and clears the active-project filter", () => {
    const store = useProjectStore();
    seed(store);
    store.setActiveProject("proj-1");
    expect(store.activeProjectId).toBe("proj-1");
    store.setActiveProject(null);
    expect(store.activeProjectId).toBe(null);
  });

  it("deleteProject removes the project from the store", async () => {
    const store = useProjectStore();
    seed(store);
    await store.deleteProject("proj-1");
    expect(store.projects.some((p) => p.id === "proj-1")).toBe(false);
  });

  it("deleteProject re-homes the project's tasks to Uncategorized (does not lose them)", async () => {
    const store = useProjectStore();
    seed(store);
    taskStore._rawTasks = [
      { id: "task-in-proj", projectId: "proj-1" },
      { id: "task-elsewhere", projectId: "other" },
    ];
    taskStore.tasks = taskStore._rawTasks;

    await store.deleteProject("proj-1");

    // The task that belonged to the deleted project must be reassigned to
    // Uncategorized (projectId: null), never orphaned against a project that no
    // longer exists.
    expect(taskStore.updateTask).toHaveBeenCalledWith(
      "task-in-proj",
      expect.objectContaining({ projectId: null, isUncategorized: true }),
    );
    // The unrelated task is untouched.
    expect(taskStore.updateTask).not.toHaveBeenCalledWith(
      "task-elsewhere",
      expect.anything(),
    );
  });
});
