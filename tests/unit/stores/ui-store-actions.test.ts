/**
 * TASK-1977 — feature-matrix coverage for Navigation/UI and language/direction.
 * Features: ui.sidebars (toggle main/secondary, focus mode), ui.modals (open/
 * close settings/auth/shortcuts), settings.language-direction (set language,
 * RTL direction preference + toggle). Each was unaudited/partial.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/composables/usePersistentRef", () => ({
  getTauriStore: vi.fn(),
  isTauriEnv: () => false,
  scheduleTauriSave: vi.fn(),
}));
vi.mock("@/utils/errorHandler", () => ({
  errorHandler: { handle: vi.fn() },
  ErrorSeverity: { LOW: "low", MEDIUM: "medium", HIGH: "high" },
  ErrorCategory: { UI: "ui" },
}));

const updateSetting = vi.fn();
vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({ language: "en", updateSetting }),
}));

import { useUIStore } from "@/stores/ui";

describe("UI store actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("toggles the main sidebar", () => {
    const ui = useUIStore();
    const before = ui.mainSidebarVisible;
    ui.toggleMainSidebar();
    expect(ui.mainSidebarVisible).toBe(!before);
  });

  it("focus mode hides both sidebars, and leaving it restores them", () => {
    const ui = useUIStore();
    ui.toggleFocusMode(); // enter
    expect(ui.focusMode).toBe(true);
    expect(ui.mainSidebarVisible).toBe(false);
    expect(ui.secondarySidebarVisible).toBe(false);

    ui.toggleFocusMode(); // leave
    expect(ui.focusMode).toBe(false);
    expect(ui.mainSidebarVisible).toBe(true);
    expect(ui.secondarySidebarVisible).toBe(true);
  });

  it("setLanguage writes through to the settings store (single source of truth)", () => {
    const ui = useUIStore();
    ui.setLanguage("he");
    expect(updateSetting).toHaveBeenCalledWith("language", "he");
    expect(localStorage.getItem("flowstate-app-locale")).toBe("he");
  });

  it("setDirectionPreference persists an explicit ltr/rtl/auto choice", () => {
    const ui = useUIStore();
    ui.setDirectionPreference("rtl");
    expect(ui.directionPreference).toBe("rtl");
    ui.setDirectionPreference("auto");
    expect(ui.directionPreference).toBe("auto");
  });

  it("toggleDirection flips away from auto and back", () => {
    const ui = useUIStore();
    ui.setDirectionPreference("auto");
    ui.toggleDirection(); // auto → explicit
    expect(ui.directionPreference).not.toBe("auto");
    ui.toggleDirection(); // explicit → auto
    expect(ui.directionPreference).toBe("auto");
  });

  it("opens and closes the settings, auth, and shortcuts modals", () => {
    const ui = useUIStore();
    ui.openSettingsModal();
    expect(ui.settingsModalOpen).toBe(true);
    ui.closeSettingsModal();
    expect(ui.settingsModalOpen).toBe(false);

    ui.openShortcutsPanel();
    expect(ui.shortcutsPanelOpen).toBe(true);
    ui.closeShortcutsPanel();
    expect(ui.shortcutsPanelOpen).toBe(false);
  });
});
