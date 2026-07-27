/**
 * TASK-1977 — vector: clock-jump-queue-lock-cache-and-recurrence-ordering [high]
 * (queue-ordering facet).
 *
 * Offline writes are replayed from the durable queue in the order they were
 * made — "set title A" must apply before the later "set title B", or the newer
 * edit is silently reverted. getPendingOperations ordered ONLY by `createdAt`
 * (a wall-clock Date.now()), while the true insertion order is the monotonic
 * auto-increment `id`. So if the device clock jumps BACKWARD between two
 * enqueues (NTP correction, manual change, suspend/resume, timezone glitch),
 * the later operation gets a SMALLER createdAt and replays FIRST — reverting
 * the user's newest edit.
 *
 * Contract: replay order follows enqueue order (monotonic id), never the wall
 * clock. Proven with a controllable Date.now() against the real fake-indexeddb
 * queue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";

import {
  enqueueOperation,
  getPendingOperations,
  clearAll,
} from "@/services/offline/writeQueueDB";

const baseOp = (entityId: string, title: string) => ({
  entityType: "task" as const,
  operation: "update" as const,
  entityId,
  payload: { id: entityId, title },
});

describe("write queue replay order survives a clock jump", () => {
  beforeEach(async () => {
    await clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replays operations in enqueue order even when the clock jumps backward between them", async () => {
    const nowSpy = vi.spyOn(Date, "now");

    // op1 enqueued at wall-clock 10_000
    nowSpy.mockReturnValue(10_000);
    await enqueueOperation(baseOp("task-x", "A"));

    // clock jumps BACKWARD; op2 enqueued at 5_000 but AFTER op1
    nowSpy.mockReturnValue(5_000);
    await enqueueOperation(baseOp("task-x", "B"));

    nowSpy.mockReturnValue(11_000);
    const pending = await getPendingOperations();

    const titles = pending.map((op) => op.payload.title);
    // Enqueue order was A then B. The newest edit (B) must replay LAST so it
    // wins, regardless of the smaller wall-clock stamp on op2.
    expect(titles).toEqual(["A", "B"]);
  });

  it("preserves order across many ops despite a mid-sequence backward jump", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    const stamps = [1000, 2000, 3000, 500, 600, 700]; // jump back after the 3rd
    for (let i = 0; i < stamps.length; i += 1) {
      nowSpy.mockReturnValue(stamps[i]);
      await enqueueOperation(baseOp("task-y", `v${i}`));
    }

    nowSpy.mockReturnValue(9999);
    const pending = await getPendingOperations();
    expect(pending.map((op) => op.payload.title)).toEqual([
      "v0",
      "v1",
      "v2",
      "v3",
      "v4",
      "v5",
    ]);
  });

  it("still orders correctly when the clock moves normally forward", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);
    await enqueueOperation(baseOp("task-z", "first"));
    nowSpy.mockReturnValue(2000);
    await enqueueOperation(baseOp("task-z", "second"));

    nowSpy.mockReturnValue(3000);
    const pending = await getPendingOperations();
    expect(pending.map((op) => op.payload.title)).toEqual(["first", "second"]);
  });
});

describe("recurrence next-occurrence is clock-independent (recurrence-ordering facet)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("computes the same next due date regardless of the wall clock", async () => {
    const { computeNextDueDate } = await import("@/utils/recurrenceUtils");
    const rule = {
      pattern: "daily",
      interval: 1,
    } as Parameters<typeof computeNextDueDate>[1];

    const spy = vi.spyOn(Date, "now");
    spy.mockReturnValue(9_999_999_999_999); // absurd future clock
    const fromFuture = computeNextDueDate("2026-07-01", rule);
    spy.mockReturnValue(0); // epoch
    const fromEpoch = computeNextDueDate("2026-07-01", rule);

    // Next occurrence is anchored to the task's stored due date, not Date.now().
    expect(fromFuture).toBe("2026-07-02");
    expect(fromEpoch).toBe("2026-07-02");
  });
});
