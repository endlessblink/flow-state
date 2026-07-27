/**
 * TASK-1977 — vectors: recurring-series-semantic-recovery-fidelity,
 * restore-existing-id-semantic-conflict, and the hierarchy-integrity half of
 * maximal-task-and-subtask-field-roundtrip. All were MISSING evidence.
 *
 * validateAndSortTasksForRestore is the gate every restore passes through. It
 * must (a) refuse a corrupt backup rather than write partial garbage, and
 * (b) order tasks parent-before-child so a child is never inserted against a
 * parent row that does not exist yet. A subtly wrong ordering here is silent
 * data corruption at the worst possible moment — while the user is recovering
 * data they already thought they lost.
 *
 * This function had zero test coverage. These are its contract.
 */

import { describe, expect, it } from "vitest";
import { validateAndSortTasksForRestore } from "@/composables/backup/types";
import type { Task } from "@/types/tasks";

const task = (id: string, parentTaskId: string | null = null): Task =>
  ({
    id,
    title: `Task ${id}`,
    description: "",
    status: "todo",
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: "",
    projectId: "p1",
    parentTaskId,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  }) as Task;

const indexOfId = (tasks: Task[], id: string) =>
  tasks.findIndex((t) => t.id === id);

describe("restore graph integrity (validateAndSortTasksForRestore)", () => {
  it("orders every parent before its children", () => {
    // Deliberately shuffled: child before parent, grandchild before both.
    const input = [task("c", "b"), task("a"), task("b", "a")];
    const ordered = validateAndSortTasksForRestore(input);

    expect(ordered).toHaveLength(3);
    expect(indexOfId(ordered, "a")).toBeLessThan(indexOfId(ordered, "b"));
    expect(indexOfId(ordered, "b")).toBeLessThan(indexOfId(ordered, "c"));
  });

  it("refuses a backup with duplicate task identities instead of restoring one arbitrarily", () => {
    expect(() =>
      validateAndSortTasksForRestore([task("dup"), task("dup")]),
    ).toThrow(/duplicate task identities/);
  });

  it("refuses a backup whose parent chain forms a cycle", () => {
    expect(() =>
      validateAndSortTasksForRestore([task("x", "y"), task("y", "x")]),
    ).toThrow(/parent cycle/);
  });

  it("refuses a backup that references a parent it does not contain", () => {
    expect(() =>
      validateAndSortTasksForRestore([task("orphan", "ghost-parent")]),
    ).toThrow(/missing parent/);
  });

  it("reads a legacy snake_case parent_task_id so old backups still order correctly", () => {
    const legacyChild = {
      ...task("lc"),
      parentTaskId: undefined,
      parent_task_id: "lp",
    } as unknown as Task;
    const ordered = validateAndSortTasksForRestore([legacyChild, task("lp")]);
    expect(indexOfId(ordered, "lp")).toBeLessThan(indexOfId(ordered, "lc"));
  });

  describe("selective restore (restore-existing-id-semantic-conflict)", () => {
    it("refuses to restore a child alone when its parent is neither selected nor already present", () => {
      const artifact = [task("parent"), task("child", "parent")];
      expect(() =>
        validateAndSortTasksForRestore(artifact, [task("child", "parent")]),
      ).toThrow(/omitted parent/);
    });

    it("allows restoring a child alone when its parent already exists in the target", () => {
      const artifact = [task("parent"), task("child", "parent")];
      const ordered = validateAndSortTasksForRestore(
        artifact,
        [task("child", "parent")],
        new Set(["parent"]), // parent already lives in the destination
      );
      expect(ordered.map((t) => t.id)).toEqual(["child"]);
    });

    it("returns only the selected subset, still parent-ordered", () => {
      const artifact = [task("a"), task("b", "a"), task("c", "b"), task("d")];
      const ordered = validateAndSortTasksForRestore(artifact, [
        task("a"),
        task("b", "a"),
      ]);
      expect(ordered.map((t) => t.id)).toEqual(["a", "b"]);
    });
  });

  it("handles a wide flat backup without reordering unrelated roots away", () => {
    const roots = Array.from({ length: 20 }, (_, i) => task(`r${i}`));
    const ordered = validateAndSortTasksForRestore(roots);
    expect(ordered).toHaveLength(20);
    expect(new Set(ordered.map((t) => t.id)).size).toBe(20);
  });
});
