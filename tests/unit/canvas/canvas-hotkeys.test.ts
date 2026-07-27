/**
 * TASK-1977 — feature-matrix coverage for canvas.hotkeys.
 * Canvas keyboard shortcuts: Delete/Backspace opens the bulk-delete confirm for
 * the current selection, Shift+G creates a group, and hotkeys are IGNORED while
 * typing in an input or inside a modal (so Backspace edits text, not deletes a
 * task). A single recurring task routes to the recurrence-delete flow. Was
 * unaudited.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const selectedNodes = vi.hoisted(() => ({
  value: [] as Array<{ id: string; type?: string }>,
}));
vi.mock("@vue-flow/core", () => ({
  useVueFlow: () => ({ getSelectedNodes: selectedNodes }),
}));

const canvasStore = vi.hoisted(() => ({
  sections: [] as Array<{ id: string; name: string }>,
}));
vi.mock("@/stores/canvas", () => ({ useCanvasStore: () => canvasStore }));

const taskStore = vi.hoisted(() => ({
  getTask: (id: string) => ({ id, title: `Task ${id}` }),
  rawTasks: [] as Array<{ id: string; recurrenceRule?: unknown }>,
  tasks: [] as unknown[],
}));
vi.mock("@/stores/tasks", () => ({ useTaskStore: () => taskStore }));

import { useCanvasHotkeys } from "@/composables/canvas/useCanvasHotkeys";

function makeDeps() {
  return {
    isBulkDeleteModalOpen: ref(false),
    bulkDeleteItems: ref<
      { id: string; name: string; type: "task" | "section" | "image" }[]
    >([]),
    bulkDeleteIsPermanent: ref(false),
    createGroup: vi.fn().mockResolvedValue("new-group"),
  };
}

const keyEvent = (
  init: Partial<KeyboardEvent> & { key: string; target?: unknown },
) => {
  const e = {
    key: init.key,
    shiftKey: !!init.shiftKey,
    target: init.target ?? document.body,
    preventDefault: vi.fn(),
  };
  return e as unknown as KeyboardEvent;
};

describe("canvas hotkeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedNodes.value = [];
    canvasStore.sections = [];
    taskStore.rawTasks = [];
  });

  it("Delete with a selection opens the bulk-delete confirmation for those items", async () => {
    selectedNodes.value = [{ id: "task-1" }, { id: "task-2" }];
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);

    await handleKeyDown(keyEvent({ key: "Delete" }));

    expect(deps.isBulkDeleteModalOpen.value).toBe(true);
    expect(deps.bulkDeleteItems.value.map((i) => i.id)).toEqual([
      "task-1",
      "task-2",
    ]);
    expect(deps.bulkDeleteIsPermanent.value).toBe(false);
  });

  it("Shift+Delete marks the delete as permanent", async () => {
    selectedNodes.value = [{ id: "task-1" }];
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);
    await handleKeyDown(keyEvent({ key: "Delete", shiftKey: true }));
    expect(deps.bulkDeleteIsPermanent.value).toBe(true);
  });

  it("Shift+G creates a group", async () => {
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);
    await handleKeyDown(keyEvent({ key: "g", shiftKey: true }));
    expect(deps.createGroup).toHaveBeenCalledTimes(1);
  });

  it("does NOT delete while typing in an input (Backspace edits text instead)", async () => {
    selectedNodes.value = [{ id: "task-1" }];
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);
    const input = document.createElement("input");

    await handleKeyDown(keyEvent({ key: "Backspace", target: input }));

    expect(deps.isBulkDeleteModalOpen.value).toBe(false);
    expect(deps.bulkDeleteItems.value).toHaveLength(0);
  });

  it("does NOT fire hotkeys inside a modal", async () => {
    selectedNodes.value = [{ id: "task-1" }];
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    const child = document.createElement("button");
    modal.appendChild(child);

    await handleKeyDown(keyEvent({ key: "Delete", target: child }));
    expect(deps.isBulkDeleteModalOpen.value).toBe(false);
  });

  it("Delete with no selection does nothing", async () => {
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);
    await handleKeyDown(keyEvent({ key: "Delete" }));
    expect(deps.isBulkDeleteModalOpen.value).toBe(false);
  });

  it("a single recurring task routes to the recurrence-delete flow, not the bulk modal", async () => {
    selectedNodes.value = [{ id: "rec-1" }];
    taskStore.rawTasks = [
      { id: "rec-1", recurrenceRule: { frequency: "weekly" } },
    ];
    const deps = makeDeps();
    const { handleKeyDown } = useCanvasHotkeys(deps);
    const dispatched: string[] = [];
    const listener = (e: Event) => dispatched.push((e as CustomEvent).type);
    window.addEventListener("recurrence-delete-requested", listener);

    await handleKeyDown(keyEvent({ key: "Delete" }));

    window.removeEventListener("recurrence-delete-requested", listener);
    expect(dispatched).toContain("recurrence-delete-requested");
    expect(deps.isBulkDeleteModalOpen.value).toBe(false);
  });
});
