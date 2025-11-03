import { test, expect } from '@playwright/test'

test.describe('ProjectModal BaseModal Migration', () => {
  test('Create story renders correctly with BaseModal', async ({ page }) => {
    // Navigate to Storybook ProjectModal Create story
    await page.goto('http://localhost:6006/iframe.html?id=overlays-modals-projectmodal--create&viewMode=story')

    // Wait for modal to render
    await page.waitForSelector('.modal-overlay', { timeout: 5000 })

    // Verify BaseModal structure is present
    const modalContainer = page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // Verify modal header (from BaseModal)
    const modalTitle = page.locator('.modal-title')
    await expect(modalTitle).toContainText('Create Project')

    // Verify close button (from BaseModal)
    const closeButton = page.locator('.modal-close-btn')
    await expect(closeButton).toBeVisible()

    // Verify form content is present
    const nameInput = page.locator('input[placeholder="Enter project name..."]')
    await expect(nameInput).toBeVisible()

    // Verify parent project select
    const parentSelect = page.locator('.parent-project-select')
    await expect(parentSelect).toBeVisible()

    // Verify icon/color selection preview
    const selectionPreview = page.locator('.selection-preview')
    await expect(selectionPreview).toBeVisible()

    // Verify footer buttons (BaseButton components)
    const cancelButton = page.locator('button:has-text("Cancel")')
    const createButton = page.locator('button:has-text("Create Project")')
    await expect(cancelButton).toBeVisible()
    await expect(createButton).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/.playwright-mcp/project-modal-create-basemodal.png' })

    console.log('✓ ProjectModal Create story renders correctly with BaseModal')
  })

  test('Edit story renders correctly with BaseModal', async ({ page }) => {
    // Navigate to Storybook ProjectModal Edit story
    await page.goto('http://localhost:6006/iframe.html?id=overlays-modals-projectmodal--edit&viewMode=story')

    // Wait for modal to render
    await page.waitForSelector('.modal-overlay', { timeout: 5000 })

    // Verify modal title shows edit mode
    const modalTitle = page.locator('.modal-title')
    await expect(modalTitle).toContainText('Edit Project')

    // Verify pre-filled name input
    const nameInput = page.locator('input[placeholder="Enter project name..."]')
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toHaveValue('My Tasks')

    // Verify save button
    const saveButton = page.locator('button:has-text("Save Changes")')
    await expect(saveButton).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/.playwright-mcp/project-modal-edit-basemodal.png' })

    console.log('✓ ProjectModal Edit story renders correctly with BaseModal')
  })

  test('EditWithEmoji story shows emoji picker integration', async ({ page }) => {
    // Navigate to Storybook ProjectModal EditWithEmoji story
    await page.goto('http://localhost:6006/iframe.html?id=overlays-modals-projectmodal--edit-with-emoji&viewMode=story')

    // Wait for modal to render
    await page.waitForSelector('.modal-overlay', { timeout: 5000 })

    // Verify emoji is displayed in preview
    const previewEmoji = page.locator('.preview-emoji')
    await expect(previewEmoji).toBeVisible()
    await expect(previewEmoji).toContainText('🎯')

    // Verify name is pre-filled
    const nameInput = page.locator('input[placeholder="Enter project name..."]')
    await expect(nameInput).toHaveValue('Personal Goals')

    // Verify "Change Icon" button is present
    const changeIconButton = page.locator('button:has-text("Change Icon")')
    await expect(changeIconButton).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: '.playwright-mcp/.playwright-mcp/project-modal-emoji-basemodal.png' })

    console.log('✓ ProjectModal EditWithEmoji story shows emoji integration')
  })

  test('Glass morphism styling is preserved', async ({ page }) => {
    await page.goto('http://localhost:6006/iframe.html?id=overlays-modals-projectmodal--create&viewMode=story')

    await page.waitForSelector('.modal-container', { timeout: 5000 })

    // Get computed styles of modal container
    const modalContainer = page.locator('.modal-container')
    const backdropFilter = await modalContainer.evaluate(el =>
      window.getComputedStyle(el).backdropFilter
    )

    // Verify backdrop filter is applied (glass morphism)
    expect(backdropFilter).toContain('blur')

    // Check selection preview has glass morphism
    const selectionPreview = page.locator('.selection-preview')
    const previewBg = await selectionPreview.evaluate(el =>
      window.getComputedStyle(el).background || window.getComputedStyle(el).backgroundColor
    )

    // Verify preview has background styling
    expect(previewBg).toBeTruthy()

    console.log('✓ Glass morphism styling is preserved after BaseModal migration')
  })

  test('Disabled state for save button when name is empty', async ({ page }) => {
    await page.goto('http://localhost:6006/iframe.html?id=overlays-modals-projectmodal--create&viewMode=story')

    await page.waitForSelector('.modal-container', { timeout: 5000 })

    // Clear the name input
    const nameInput = page.locator('input[placeholder="Enter project name..."]')
    await nameInput.fill('')

    // Verify create button is disabled
    const createButton = page.locator('button:has-text("Create Project")')
    await expect(createButton).toBeDisabled()

    // Add text
    await nameInput.fill('New Project')

    // Verify button is now enabled
    await expect(createButton).toBeEnabled()

    console.log('✓ Save button disabled state works correctly')
  })
})
