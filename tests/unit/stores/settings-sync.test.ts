/**
 * Settings Sync to Supabase — Unit Tests
 *
 * Tests for:
 * 1. doSettingsUpsert strips sensitive fields (googleProviderToken, googleProviderRefreshToken,
 *    googleProviderTokenExpiry, groqApiKey)
 * 2. doSettingsUpsert includes non-sensitive Google fields (googleConnected, googleCalendars,
 *    showGoogleCalendarEvents)
 * 3. doSettingsUpsert logs success on successful upsert
 * 4. doSettingsUpsert logs error on failed upsert
 * 5. syncSettingsToSupabase retries when no auth user
 * 6. syncSettingsToSupabase skips when supabase client is null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ============================================================================
// Module-level mocks — hoisted before store import
// ============================================================================

const mockUpsert = vi.fn();
const mockGetUser = vi.fn();
const mockAuthState = { user: { id: "user-abc-123" } as { id: string } | null };

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => mockAuthState,
}));

// vi.mock is hoisted at compile time; this intercepts BOTH static and
// dynamic `import('@/services/auth/supabase')` calls made by the store.
vi.mock("@/services/auth/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (_table: string) => ({
      upsert: (data: unknown, opts: unknown) => mockUpsert(data, opts),
    }),
  },
}));

// Stub Tauri env so saveToStorage doesn't try to call Tauri APIs
vi.mock("@/composables/usePersistentRef", () => ({
  isTauriEnv: () => false,
  getTauriStore: vi.fn(),
  scheduleTauriSave: vi.fn(),
}));

// ============================================================================
// Store import — AFTER mocks
// ============================================================================

import { useSettingsStore } from "@/stores/settings";

// ============================================================================
// Helpers
// ============================================================================

/** Advance fake timers past both the 2 s debounce AND the 5 s retry. */
async function flushDebounce(ms = 2500) {
  await vi.advanceTimersByTimeAsync(ms);
}

// ============================================================================
// Tests
// ============================================================================

describe("Settings Supabase sync", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Default: authenticated user present
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-abc-123" } } });
    mockAuthState.user = { id: "user-abc-123" };
    // Default: upsert succeeds
    mockUpsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // 1. Sensitive fields are stripped
  // --------------------------------------------------------------------------

  it("strips googleProviderToken from the settings blob sent to Supabase", async () => {
    const store = useSettingsStore();
    store.$patch({
      googleProviderToken: "secret-access-token",
      googleConnected: true,
    });

    store.saveToStorage();
    await flushDebounce();

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).not.toHaveProperty("googleProviderToken");
  });

  it("strips googleProviderRefreshToken from the settings blob", async () => {
    const store = useSettingsStore();
    store.$patch({ googleProviderRefreshToken: "secret-refresh-token" });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).not.toHaveProperty(
      "googleProviderRefreshToken",
    );
  });

  it("strips googleProviderTokenExpiry from the settings blob", async () => {
    const store = useSettingsStore();
    store.$patch({ googleProviderTokenExpiry: 9999999999999 });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).not.toHaveProperty(
      "googleProviderTokenExpiry",
    );
  });

  it("strips groqApiKey from the settings blob", async () => {
    const store = useSettingsStore();
    store.$patch({ groqApiKey: "gsk_supersecretkey" });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).not.toHaveProperty("groqApiKey");
  });

  // --------------------------------------------------------------------------
  // 2. Non-sensitive Google fields ARE included
  // --------------------------------------------------------------------------

  it("includes googleConnected in the settings blob", async () => {
    const store = useSettingsStore();
    store.$patch({ googleConnected: true });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).toHaveProperty("googleConnected", true);
  });

  it("includes googleCalendars in the settings blob", async () => {
    const store = useSettingsStore();
    store.$patch({
      googleCalendars: [
        {
          id: "cal-1",
          summary: "Work",
          backgroundColor: "#0f0",
          enabled: true,
        },
      ],
    });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).toHaveProperty("googleCalendars");
    expect(upsertPayload.settings.googleCalendars).toHaveLength(1);
    expect(upsertPayload.settings.googleCalendars[0].id).toBe("cal-1");
  });

  it("includes showGoogleCalendarEvents in the settings blob", async () => {
    const store = useSettingsStore();
    store.$patch({ showGoogleCalendarEvents: false });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).toHaveProperty(
      "showGoogleCalendarEvents",
      false,
    );
  });

  // TASK-1977: feature-matrix settings.pomodoro-auto — the auto-start toggles
  // must actually reach Supabase, not just live in memory.
  it("includes the auto-start pomodoro toggle in the synced settings", async () => {
    const store = useSettingsStore();
    store.$patch({ autoStartPomodoros: true });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).toHaveProperty("autoStartPomodoros", true);
  });

  it("includes the auto-start breaks toggle in the synced settings", async () => {
    const store = useSettingsStore();
    store.$patch({ autoStartBreaks: true });

    store.saveToStorage();
    await flushDebounce();

    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.settings).toHaveProperty("autoStartBreaks", true);
  });

  // --------------------------------------------------------------------------
  // 3. Success path — console.log
  // --------------------------------------------------------------------------

  it("uses the hydrated auth identity without requesting /auth/v1/user", async () => {
    mockGetUser.mockRejectedValue(new Error("remote auth validation was rate limited"));

    const store = useSettingsStore();
    store.saveToStorage();
    await flushDebounce();

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0][0].user_id).toBe("user-abc-123");
  });

  it("logs success message when upsert succeeds", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const store = useSettingsStore();
    store.saveToStorage();
    await flushDebounce();

    const successCalls = logSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === "string" && msg.includes("[SETTINGS] Settings synced"),
    );
    expect(successCalls.length).toBeGreaterThanOrEqual(1);

    logSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 4. Error path — console.error
  // --------------------------------------------------------------------------

  it("logs error when upsert returns an error object", async () => {
    mockUpsert.mockResolvedValue({
      error: { message: "RLS violation", code: "42501" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const store = useSettingsStore();
    store.saveToStorage();
    await flushDebounce();

    const errorCalls = errorSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === "string" &&
        msg.includes("[SETTINGS] Supabase upsert failed"),
    );
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);

    errorSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 5. Retry when no auth user
  // --------------------------------------------------------------------------

  it("schedules a retry via setTimeout when the hydrated auth store has no user", async () => {
    mockAuthState.user = null;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = useSettingsStore();
    store.saveToStorage();

    // Advance past the 2 s debounce so syncSettingsToSupabase fires
    await vi.advanceTimersByTimeAsync(2500);

    // The retry setTimeout of 5 s should have been registered.
    // Advance past it too so the retry attempt runs.
    await vi.advanceTimersByTimeAsync(5500);

    const retryCalls = warnSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === "string" &&
        (msg.includes("No authenticated user") ||
          msg.includes("Retry: still no authenticated user")),
    );
    expect(retryCalls.length).toBeGreaterThanOrEqual(1);

    warnSpy.mockRestore();
  });

  it("calls upsert on the retry after the auth store hydrates a user", async () => {
    mockAuthState.user = null;

    const store = useSettingsStore();
    store.saveToStorage();

    await vi.advanceTimersByTimeAsync(2500); // debounce
    mockAuthState.user = { id: "user-retry-123" };
    await vi.advanceTimersByTimeAsync(5500); // retry

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [upsertPayload] = mockUpsert.mock.calls[0];
    expect(upsertPayload.user_id).toBe("user-retry-123");
  });

  // --------------------------------------------------------------------------
  // 6. Skips when supabase client is null
  // --------------------------------------------------------------------------

  it("does not query remote auth while the local identity is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAuthState.user = null;

    const store = useSettingsStore();
    store.saveToStorage();
    await flushDebounce();

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
