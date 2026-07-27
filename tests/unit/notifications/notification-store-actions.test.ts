/**
 * TASK-1977 — feature-matrix coverage for Notifications & Reminders.
 * Features: notify.snooze-dismiss (snooze reschedules, dismiss clears without
 * re-firing), notify.preferences (default preferences update). Were unaudited.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const saveNotifications = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
vi.mock("@/composables/useSupabaseDatabase", () => ({
  useSupabaseDatabase: () => ({
    saveNotifications,
    fetchNotifications: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock("@/utils/errorHandler", () => ({
  errorHandler: { report: vi.fn(), handle: vi.fn() },
  ErrorSeverity: { LOW: "low", MEDIUM: "medium", HIGH: "high" },
  ErrorCategory: { NOTIFICATION: "notification" },
}));
vi.mock("@/utils/notificationDelivery", () => ({
  deliverNotification: vi.fn(),
}));
vi.mock("@/utils/platform", async (importOriginal) => ({
  ...(await importOriginal()),
  isTauri: () => false,
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "user-1" } }),
}));

import { useNotificationStore } from "@/stores/notifications";

const seedNotification = (
  store: ReturnType<typeof useNotificationStore>,
  over = {},
) => {
  (store._rawNotifications as unknown[]).push({
    id: "notif-1",
    taskId: "task-1",
    title: "Reminder",
    scheduledFor: new Date("2026-07-01T09:00:00Z"),
    isShown: true,
    isDismissed: false,
    snoozedUntil: null,
    ...over,
  });
};

describe("Notification store actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("snooze reschedules the notification into the future and un-shows it", async () => {
    const store = useNotificationStore();
    seedNotification(store);
    const before = Date.now();

    await store.snoozeNotification("notif-1");

    const n = store._rawNotifications.find((x) => x.id === "notif-1")!;
    expect(n.snoozedUntil).toBeTruthy();
    expect(new Date(n.snoozedUntil).getTime()).toBeGreaterThan(before);
    expect(n.isShown).toBe(false);
    expect(n.isDismissed).toBe(false);
    expect(saveNotifications).toHaveBeenCalled();
  });

  it("dismiss marks the notification dismissed so it does not re-fire", async () => {
    const store = useNotificationStore();
    seedNotification(store);

    await store.dismissNotification("notif-1");

    const n = store._rawNotifications.find((x) => x.id === "notif-1")!;
    expect(n.isDismissed).toBe(true);
    // A dismissed notification is excluded from the active set.
    expect(store.activeNotifications.some((x) => x.id === "notif-1")).toBe(
      false,
    );
    expect(saveNotifications).toHaveBeenCalled();
  });

  it("snooze / dismiss on a missing id is a safe no-op", async () => {
    const store = useNotificationStore();
    await expect(store.snoozeNotification("nope")).resolves.toBeUndefined();
    await expect(store.dismissNotification("nope")).resolves.toBeUndefined();
  });

  it("updateDefaultPreferences merges without dropping other preferences", async () => {
    const store = useNotificationStore();
    const original = { ...store.defaultPreferences };

    await store.updateDefaultPreferences({ snoozeDuration: 25 });

    expect(store.defaultPreferences.snoozeDuration).toBe(25);
    // Other keys preserved (merge, not replace).
    for (const key of Object.keys(original)) {
      if (key !== "snoozeDuration") {
        expect(store.defaultPreferences[key]).toEqual(original[key]);
      }
    }
  });
});
