/**
 * TASK-1977 — feature-matrix coverage for capture.brain-dump.
 * Brain-dump turns many typed lines into tasks. The critical invariant: EVERY
 * non-empty line becomes exactly one durable task — none silently dropped — and
 * inline priority (!/!!/!!!) and duration (2h/30m) shorthands are parsed. Was
 * unaudited.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const createTaskWithUndo = vi.hoisted(() => vi.fn());
vi.mock("@/composables/useUnifiedUndoRedo", () => ({
  useUnifiedUndoRedo: () => ({ createTaskWithUndo }),
}));
// Offline: skip the URL-scraping branch so the test is deterministic.
vi.mock("@vueuse/core", () => ({ useOnline: () => ({ value: false }) }));
vi.mock("@/utils/urlDetection", () => ({ isUrl: () => false }));
vi.mock("@/services/ai/urlScraper", () => ({ scrapeUrl: vi.fn() }));

import { useBrainDump } from "@/composables/useBrainDump";

describe("brain-dump capture", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates exactly one task per non-empty line — none dropped", async () => {
    const bd = useBrainDump();
    bd.brainDumpText.value = "first task\nsecond task\nthird task";

    expect(bd.parsedTaskCount.value).toBe(3);
    await bd.processBrainDump();

    expect(createTaskWithUndo).toHaveBeenCalledTimes(3);
    const titles = createTaskWithUndo.mock.calls.map(([t]) => t.title);
    expect(titles).toEqual(["first task", "second task", "third task"]);
    // Every task lands in the inbox as a todo.
    for (const [t] of createTaskWithUndo.mock.calls) {
      expect(t.status).toBe("todo");
      expect(t.isInInbox).toBe(true);
    }
  });

  it("ignores blank lines so empties never become phantom tasks", async () => {
    const bd = useBrainDump();
    bd.brainDumpText.value = "real task\n\n   \nanother real task\n";

    expect(bd.parsedTaskCount.value).toBe(2);
    await bd.processBrainDump();
    expect(createTaskWithUndo).toHaveBeenCalledTimes(2);
  });

  it("parses inline priority shorthand (!/!!/!!!)", async () => {
    const bd = useBrainDump();
    bd.brainDumpText.value = "urgent !!!\nmedium !!\nlow !";
    await bd.processBrainDump();

    const byTitle = Object.fromEntries(
      createTaskWithUndo.mock.calls.map(([t]) => [t.title, t.priority]),
    );
    expect(byTitle["urgent"]).toBe("high");
    expect(byTitle["medium"]).toBe("medium");
    expect(byTitle["low"]).toBe("low");
  });

  it("parses inline duration shorthand (2h → 120m, 30m → 30m)", async () => {
    const bd = useBrainDump();
    bd.brainDumpText.value = "deep work 2h\nquick call 30m";
    await bd.processBrainDump();

    const byTitle = Object.fromEntries(
      createTaskWithUndo.mock.calls.map(([t]) => [
        t.title,
        t.estimatedDuration,
      ]),
    );
    expect(byTitle["deep work"]).toBe(120);
    expect(byTitle["quick call"]).toBe(30);
  });

  it("clears the input and exits brain-dump mode after processing", async () => {
    const bd = useBrainDump();
    bd.brainDumpMode.value = true;
    bd.brainDumpText.value = "a task";
    await bd.processBrainDump();
    expect(bd.brainDumpText.value).toBe("");
    expect(bd.brainDumpMode.value).toBe(false);
  });

  it("does nothing on empty input (no phantom task)", async () => {
    const bd = useBrainDump();
    bd.brainDumpText.value = "   \n  ";
    await bd.processBrainDump();
    expect(createTaskWithUndo).not.toHaveBeenCalled();
  });
});
