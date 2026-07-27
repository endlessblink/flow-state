/**
 * Capture web baseline screenshots for visual regression.
 * Run: CAPTURE_VISUAL_BASELINES=1 npm run test:e2e -- --grep "baseline" --project=chromium --workers=1
 *
 * TASK-1977: this spec WRITES the reference images that visual regression
 * compares against. It used to run as part of every full E2E run, which meant
 * each run silently overwrote the references with whatever the app currently
 * looked like — a visual regression could never be detected, because the
 * "expected" image was regenerated from the possibly-broken build. It also
 * churned tracked PNGs in the worktree on every run, which is one of the
 * things that keeps forcing release provenance to report dirty.
 *
 * Capturing is now explicit and opt-in. Updating a baseline should be a
 * deliberate act with a reviewable diff, never a side effect of running tests.
 */
import { test } from "../fixtures/auth";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(__dirname, "../visual/baseline");

if (!fs.existsSync(BASELINE_DIR))
  fs.mkdirSync(BASELINE_DIR, { recursive: true });

const VIEWS = [
  { route: "/#/", name: "canvas" },
  { route: "/#/board", name: "board" },
  { route: "/#/tasks", name: "catalog" },
  { route: "/#/calendar", name: "calendar" },
];

test.describe("Web Baseline Screenshots", () => {
  test.skip(
    !process.env.CAPTURE_VISUAL_BASELINES,
    "Baseline capture overwrites the committed reference images. Set CAPTURE_VISUAL_BASELINES=1 to intentionally re-record them.",
  );

  for (const view of VIEWS) {
    test(`capture ${view.name} baseline`, async ({ page }) => {
      await page.goto(view.route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(BASELINE_DIR, `web-${view.name}.png`),
        fullPage: false,
      });
    });
  }

  test("capture inbox baseline", async ({ page }) => {
    await page.goto("/#/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const inbox = page.locator(".unified-inbox-panel, .inbox-panel").first();
    if (await inbox.isVisible()) {
      await inbox.screenshot({
        path: path.join(BASELINE_DIR, "web-inbox.png"),
      });
    }
  });
});
