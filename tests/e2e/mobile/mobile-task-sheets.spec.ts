import { test, expect } from "../../fixtures/auth";
import {
  dismissBlockingModals,
  registerModalHandlers,
  suppressOnboarding,
  MOBILE_PHONE_OPTIONS,
} from "./mobile-helpers";

// Helper: swipe right on the first swipeable task item to reveal the Edit action
async function swipeTaskToEdit(page: import("@playwright/test").Page) {
  const swipeable = page.locator(".swipeable-task-item").first();
  await expect(swipeable).toBeVisible({ timeout: 8000 });

  const box = await swipeable.boundingBox();
  if (!box)
    throw new Error("Could not get bounding box of swipeable task item");

  const startX = box.x + 10;
  const endX = box.x + 110; // 100px right swipe — exceeds the 80px SWIPE_THRESHOLD
  const midY = box.y + box.height / 2;

  await page.touchscreen.tap(startX, midY);
  await page.mouse.move(startX, midY);
  await page.touchscreen.tap(startX, midY); // ensure touch is registered

  // TASK-1977: synthesise the swipe portably.
  //
  // This used to build events with `new TouchEvent(...)` and `new Touch(...)`.
  // WebKit does not expose a Touch constructor, so on mobile-safari every call
  // threw "TypeError: Illegal constructor" and took the whole Task Sheets suite
  // (6 tests) down with it — meaning the mobile Safari surface, i.e. the iPhone
  // PWA, had no evidence at all while appearing to be covered.
  //
  // The component's handlers only read `e.touches[0].clientX/clientY`, so a
  // plain cancelable Event carrying a `touches`/`changedTouches` array is
  // sufficient and constructs identically in every engine.
  await page.evaluate(
    ({ startX, endX, midY }) => {
      const el = document.querySelector(
        ".swipeable-task-item .swipeable-content",
      ) as HTMLElement;
      if (!el) return;

      const point = (x: number) => ({
        identifier: 1,
        target: el,
        clientX: x,
        clientY: midY,
        pageX: x,
        pageY: midY,
        screenX: x,
        screenY: midY,
      });

      const dispatchTouch = (
        type: string,
        touches: unknown[],
        changed: unknown[],
      ) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "touches", { value: touches });
        Object.defineProperty(event, "changedTouches", { value: changed });
        Object.defineProperty(event, "targetTouches", { value: touches });
        el.dispatchEvent(event);
      };

      dispatchTouch("touchstart", [point(startX)], [point(startX)]);

      // Move in steps to simulate a realistic swipe
      for (let x = startX; x <= endX; x += 10) {
        dispatchTouch("touchmove", [point(x)], [point(x)]);
      }

      dispatchTouch("touchend", [], [point(endX)]);
    },
    { startX, endX, midY },
  );
}

test.describe("Mobile Task Bottom Sheets", () => {
  test.use(MOBILE_PHONE_OPTIONS);

  test.beforeEach(async ({ page }) => {
    await registerModalHandlers(page);
    await suppressOnboarding(page);
  });

  // ================================================================
  // Task Create Sheet
  // ================================================================
  test.describe("Task Create Sheet", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/#/tasks");
      await page.waitForLoadState("networkidle");
      await dismissBlockingModals(page);
      await expect(page.locator(".mobile-inbox")).toBeVisible({
        timeout: 10000,
      });
    });

    test("FAB button opens task create sheet", async ({ page }) => {
      // The FAB is rendered by MobileInboxQuickAdd and emits open-task-create-sheet
      const fab = page.getByRole("button", { name: /add task/i });
      await expect(fab).toBeVisible({ timeout: 5000 });
      await fab.click();

      await expect(page.locator(".task-create-sheet")).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator(".sheet-overlay")).toBeVisible();
    });

    test("title input is visible and accepts text", async ({ page }) => {
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();

      const titleInput = page.locator(".task-create-sheet .title-input");
      await expect(titleInput).toBeVisible({ timeout: 5000 });

      await titleInput.fill("My new task");
      await expect(titleInput).toHaveValue("My new task");
    });

    test("Add Task button is disabled when title is empty", async ({
      page,
    }) => {
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();

      const addBtn = page.locator(".task-create-sheet .action-btn.add-action");
      await expect(addBtn).toBeVisible({ timeout: 5000 });
      await expect(addBtn).toBeDisabled();
    });

    test("due date chips are visible — Today, Tomorrow, +1wk", async ({
      page,
    }) => {
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();

      const compactOptions = page.locator(
        ".task-create-sheet .compact-options",
      );
      await expect(compactOptions).toBeVisible({ timeout: 5000 });

      await expect(
        compactOptions.locator(".chip", { hasText: "Today" }),
      ).toBeVisible();
      await expect(
        compactOptions.locator(".chip", { hasText: "Tomorrow" }),
      ).toBeVisible();
      await expect(
        compactOptions.locator(".chip", { hasText: "+1wk" }),
      ).toBeVisible();
    });

    test("priority chips are visible — High, Medium, Low", async ({ page }) => {
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();

      const compactOptions = page.locator(
        ".task-create-sheet .compact-options",
      );
      await expect(compactOptions).toBeVisible({ timeout: 5000 });

      await expect(compactOptions.locator(".chip.priority-high")).toBeVisible();
      await expect(
        compactOptions.locator(".chip.priority-medium"),
      ).toBeVisible();
      await expect(compactOptions.locator(".chip.priority-low")).toBeVisible();
    });

    test("Cancel button closes the sheet", async ({ page }) => {
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();

      await expect(page.locator(".task-create-sheet")).toBeVisible({
        timeout: 5000,
      });

      // Wait past the 400ms grace period that prevents accidental immediate close on mobile
      await page.waitForTimeout(500);

      // Cancel with empty form — should close immediately (no discard-warning needed)
      const cancelBtn = page
        .locator(".task-create-sheet")
        .getByRole("button", { name: "Cancel" });
      await cancelBtn.click();

      await expect(page.locator(".task-create-sheet")).toBeHidden({
        timeout: 5000,
      });
    });

    test("filling title and clicking Add Task creates a task and closes sheet", async ({
      page,
    }) => {
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();

      const titleInput = page.locator(".task-create-sheet .title-input");
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill("E2E Created Task");

      // Add button should be enabled now
      const addBtn = page.locator(".task-create-sheet .action-btn.add-action");
      await expect(addBtn).toBeEnabled();
      await addBtn.click();

      // Sheet should close
      await expect(page.locator(".task-create-sheet")).toBeHidden({
        timeout: 5000,
      });

      // New task should appear in the list
      await expect(
        page.locator(".mobile-inbox").getByText("E2E Created Task"),
      ).toBeVisible({ timeout: 8000 });
    });
  });

  // ================================================================
  // Task Edit Sheet
  // ================================================================
  test.describe("Task Edit Sheet", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/#/tasks");
      await page.waitForLoadState("networkidle");
      await dismissBlockingModals(page);
      await expect(page.locator(".mobile-inbox")).toBeVisible({
        timeout: 10000,
      });

      // Create a task first so there's something to swipe on
      // (seeded data may not appear in inbox due to async loading)
      const fab = page.getByRole("button", { name: /add task/i });
      await fab.click();
      const titleInput = page.locator(".task-create-sheet .title-input");
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill("Test Edit Task");
      const addBtn = page.locator(".task-create-sheet .action-btn.add-action");
      await expect(addBtn).toBeEnabled();
      await addBtn.click();
      await expect(page.locator(".task-create-sheet")).toBeHidden({
        timeout: 5000,
      });

      // Wait for the created task to appear as a swipeable item
      await expect(page.locator(".swipeable-task-item").first()).toBeVisible({
        timeout: 8000,
      });
    });

    test("right-swipe on a task opens the edit sheet", async ({ page }) => {
      await swipeTaskToEdit(page);
      await expect(page.locator(".task-edit-sheet")).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator(".sheet-overlay")).toBeVisible();
    });

    test("edit sheet shows the task title in the title input", async ({
      page,
    }) => {
      await swipeTaskToEdit(page);

      const titleInput = page.locator(".task-edit-sheet .title-input");
      await expect(titleInput).toBeVisible({ timeout: 5000 });

      // Title should be non-empty (populated from the tapped task)
      const value = await titleInput.inputValue();
      expect(value.trim().length).toBeGreaterThan(0);
    });

    test("priority pills are visible — High, Med, Low", async ({ page }) => {
      await swipeTaskToEdit(page);

      const editSheet = page.locator(".task-edit-sheet");
      await expect(editSheet).toBeVisible({ timeout: 5000 });

      await expect(editSheet.locator(".pill.pill-high")).toBeVisible();
      await expect(editSheet.locator(".pill.pill-medium")).toBeVisible();
      await expect(editSheet.locator(".pill.pill-low")).toBeVisible();
    });

    // TASK-1977: this asserted an "In Progress" pill that the app does not and
    // should not have — `Task['status']` is `'todo' | 'done'`, and the only
    // references to `in_progress` anywhere in src/ are Storybook fixtures. The
    // test was encoding a status the model never had, so it could only ever
    // fail. Corrected to the real contract, and strengthened: selecting a pill
    // must actually mark it active, not merely render.
    test("status pills are visible and selectable — To Do, Done", async ({
      page,
    }) => {
      await swipeTaskToEdit(page);

      const editSheet = page.locator(".task-edit-sheet");
      await expect(editSheet).toBeVisible({ timeout: 5000 });

      const todoPill = editSheet.locator(".pill", { hasText: "To Do" });
      const donePill = editSheet.locator(".pill", { hasText: "Done" });
      await expect(todoPill).toBeVisible();
      await expect(donePill).toBeVisible();

      // The model has exactly two statuses; a third pill would mean the sheet
      // drifted from Task['status'].
      await expect(
        editSheet.locator(".pill", { hasText: "In Progress" }),
      ).toHaveCount(0);

      await donePill.click();
      await expect(donePill).toHaveClass(/active/);
      await todoPill.click();
      await expect(todoPill).toHaveClass(/active/);
      await expect(donePill).not.toHaveClass(/active/);
    });

    test("Cancel button closes the edit sheet", async ({ page }) => {
      await swipeTaskToEdit(page);

      await expect(page.locator(".task-edit-sheet")).toBeVisible({
        timeout: 5000,
      });

      const cancelBtn = page
        .locator(".task-edit-sheet")
        .getByRole("button", { name: "Cancel" });
      await expect(cancelBtn).toBeVisible({ timeout: 5000 });
      await cancelBtn.click();

      await expect(page.locator(".task-edit-sheet")).toBeHidden({
        timeout: 5000,
      });
    });

    test("Save button is present and enabled when title is non-empty", async ({
      page,
    }) => {
      await swipeTaskToEdit(page);

      await expect(page.locator(".task-edit-sheet")).toBeVisible({
        timeout: 5000,
      });

      const saveBtn = page
        .locator(".task-edit-sheet")
        .getByRole("button", { name: /Save Changes/i });
      await expect(saveBtn).toBeVisible({ timeout: 5000 });
      await expect(saveBtn).toBeEnabled();
    });
  });
});
