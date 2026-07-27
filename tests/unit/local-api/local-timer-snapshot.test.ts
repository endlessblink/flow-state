/**
 * TASK-1977 — KDE widget zombie paused-timer regression.
 *
 * The KDE widget polls /api/timer/current. A paused active session that the app
 * stopped refreshing (app closed/crashed) was served as `active: true` forever
 * because only running/inactive snapshots were aged out — so the widget showed
 * a paused 25:00 that could never be cleared. This proves the sidecar now ages
 * out a stale paused session while keeping a live one.
 */

import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  resolveLocalTimerSnapshot,
} = require("../../../server/local-api/localTimerSnapshot.cjs");

const GRACE = 15_000;
const NOW = 1_800_000_000_000;
const clock = (nowMs = NOW) => ({
  nowMs,
  graceMs: GRACE,
  nowIso: new Date(nowMs).toISOString(),
});

const pausedSnapshot = (updatedAt: number) => ({
  active: true,
  updatedAt,
  session: {
    id: "sess-1",
    task_id: "general",
    duration: 1500,
    remaining_time: 1500,
    is_active: true,
    is_paused: true,
    is_break: false,
    completed_at: null,
  },
});

const runningSnapshot = (updatedAt: number, remaining = 1500) => ({
  active: true,
  updatedAt,
  session: {
    ...pausedSnapshot(updatedAt).session,
    is_paused: false,
    remaining_time: remaining,
  },
});

describe("resolveLocalTimerSnapshot (KDE zombie paused-timer fix)", () => {
  it("serves a FRESH paused session as active (live app, legitimately paused)", () => {
    const r = resolveLocalTimerSnapshot(pausedSnapshot(NOW - 5_000), clock());
    expect(r).not.toBeNull();
    expect(r.active).toBe(true);
    expect(r.session.is_paused).toBe(true);
    expect(r.session.remaining_time).toBe(1500); // paused → no drift
  });

  it("REGRESSION: a STALE paused session is reported inactive so the widget clears it", () => {
    // The exact zombie: paused, active, but the snapshot has not been refreshed
    // for longer than the grace (app is gone).
    const r = resolveLocalTimerSnapshot(
      pausedSnapshot(NOW - (GRACE + 5_000)),
      clock(),
    );
    expect(r).toEqual({
      active: false,
      session: null,
      source: "local-snapshot",
    });
  });

  it("paused session exactly at the grace boundary is still served (not yet stale)", () => {
    const r = resolveLocalTimerSnapshot(pausedSnapshot(NOW - GRACE), clock());
    expect(r?.active).toBe(true);
  });

  it("a running session drifts down between pushes and stays active while it has time", () => {
    const r = resolveLocalTimerSnapshot(
      runningSnapshot(NOW - 3_000, 100),
      clock(),
    );
    expect(r.active).toBe(true);
    expect(r.session.remaining_time).toBe(97); // 100 - 3s drift
  });

  it("a running session that has drifted to zero and gone stale is over", () => {
    const r = resolveLocalTimerSnapshot(
      runningSnapshot(NOW - (GRACE + 5_000), 2),
      clock(),
    );
    expect(r).toBeNull();
  });

  it("a fresh inactive snapshot reports inactive; a stale one reports nothing", () => {
    const fresh = resolveLocalTimerSnapshot(
      { active: false, updatedAt: NOW - 2_000, session: null },
      clock(),
    );
    expect(fresh).toEqual({
      active: false,
      session: null,
      source: "local-snapshot",
    });
    const stale = resolveLocalTimerSnapshot(
      { active: false, updatedAt: NOW - (GRACE + 1_000), session: null },
      clock(),
    );
    expect(stale).toBeNull();
  });

  it("handles a missing/invalid snapshot", () => {
    expect(resolveLocalTimerSnapshot(null, clock())).toBeNull();
    expect(resolveLocalTimerSnapshot(undefined, clock())).toBeNull();
  });
});
