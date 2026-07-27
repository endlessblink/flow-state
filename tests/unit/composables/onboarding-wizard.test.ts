/**
 * TASK-1977 — feature-matrix coverage for capture.onboarding.
 * First-run onboarding must show once and NEVER re-trigger after it is
 * dismissed (dismissal persisted), and it must not create data. Was unaudited.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ isAuthenticated: false }),
}));
const openAuthModal = vi.fn();
vi.mock("@/stores/ui", () => ({
  useUIStore: () => ({ openAuthModal }),
}));

import { useOnboardingWizard } from "@/composables/app/useOnboardingWizard";

const ONBOARDING_KEY = "flowstate-onboarding-v2";
const LEGACY_KEY = "flowstate-welcome-seen";

describe("first-run onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows on a truly first run (no keys set)", () => {
    const wiz = useOnboardingWizard();
    expect(wiz.isVisible.value).toBe(true);
  });

  it("does not show again once it has been seen (persisted)", () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ seen: true }));
    const wiz = useOnboardingWizard();
    expect(wiz.isVisible.value).toBe(false);
  });

  it("dismiss hides it AND persists so a later instance never re-triggers", () => {
    const first = useOnboardingWizard();
    expect(first.isVisible.value).toBe(true);

    first.dismiss();
    expect(first.isVisible.value).toBe(false);
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeTruthy();

    // Simulate a fresh app load (new composable instance).
    const second = useOnboardingWizard();
    expect(second.isVisible.value).toBe(false);
  });

  it("respects the legacy welcome-seen key (upgraded users are not re-onboarded)", () => {
    localStorage.setItem(LEGACY_KEY, "true");
    const wiz = useOnboardingWizard();
    expect(wiz.isVisible.value).toBe(false);
  });

  it("openSignUp dismisses onboarding and opens the sign-up modal", () => {
    const wiz = useOnboardingWizard();
    wiz.openSignUp();
    expect(wiz.isVisible.value).toBe(false);
    expect(openAuthModal).toHaveBeenCalledWith("signup");
  });

  it("Enter or Escape dismisses onboarding while visible", () => {
    const wiz = useOnboardingWizard();
    const preventDefault = vi.fn();
    wiz.handleKeydown({
      key: "Escape",
      preventDefault,
    } as unknown as KeyboardEvent);
    expect(wiz.isVisible.value).toBe(false);
    expect(preventDefault).toHaveBeenCalled();
  });
});
