/**
 * TASK-1648: Manifest Validation Tests (5 tests)
 *
 * Validates the PWA manifest configuration in vite.config.ts:
 * - Required fields present
 * - Icon sizes correct
 * - Theme/display settings
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read the vite config to extract manifest configuration
const viteConfigPath = resolve(__dirname, '../../../vite.config.ts')
const viteConfigSource = readFileSync(viteConfigPath, 'utf-8')

// Extract the manifest object from vite config using regex
// This is a static analysis approach since we can't easily import the config
function extractManifestConfig(source: string): Record<string, any> {
  // Find the manifest block
  const manifestMatch = source.match(/manifest:\s*\{([\s\S]*?)\},\s*injectManifest/)
  if (!manifestMatch) {
    throw new Error('Could not find manifest config in vite.config.ts')
  }

  const manifestBlock = manifestMatch[1]

  // Extract individual fields
  const name = manifestBlock.match(/name:\s*'([^']+)'/)?.[1]
  const shortName = manifestBlock.match(/short_name:\s*'([^']+)'/)?.[1]
  const description = manifestBlock.match(/description:\s*'([^']+)'/)?.[1]
  const themeColor = manifestBlock.match(/theme_color:\s*'([^']+)'/)?.[1]
  const backgroundColor = manifestBlock.match(/background_color:\s*'([^']+)'/)?.[1]
  const display = manifestBlock.match(/display:\s*'([^']+)'/)?.[1]
  const startUrl = manifestBlock.match(/start_url:\s*'([^']+)'/)?.[1]
  const scope = manifestBlock.match(/scope:\s*'([^']+)'/)?.[1]

  // Extract icons array
  const iconsMatch = manifestBlock.match(/icons:\s*\[([\s\S]*?)\]/)
  const iconsBlock = iconsMatch?.[1] || ''

  // Parse individual icon entries
  const iconEntries: Array<{ src: string; sizes: string; type: string; purpose?: string }> = []
  const iconRegex = /\{\s*src:\s*'([^']+)',\s*sizes:\s*'([^']+)',\s*type:\s*'([^']+)'(?:,\s*purpose:\s*'([^']+)')?\s*\}/g
  let iconMatch
  while ((iconMatch = iconRegex.exec(iconsBlock)) !== null) {
    iconEntries.push({
      src: iconMatch[1],
      sizes: iconMatch[2],
      type: iconMatch[3],
      purpose: iconMatch[4]
    })
  }

  return {
    name,
    short_name: shortName,
    description,
    theme_color: themeColor,
    background_color: backgroundColor,
    display,
    start_url: startUrl,
    scope,
    icons: iconEntries
  }
}

const manifest = extractManifestConfig(viteConfigSource)

describe('TASK-1648: Manifest Validation', () => {
  it('1. Manifest configuration exists in vite.config.ts', () => {
    // VitePWA plugin should be configured with a manifest
    expect(viteConfigSource).toContain('VitePWA(')
    expect(viteConfigSource).toContain('manifest:')
    expect(manifest).toBeDefined()
  })

  it('2. Has required fields (name, short_name, start_url, display, icons)', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.name).toBe('FlowState')

    expect(manifest.short_name).toBeTruthy()
    expect(manifest.short_name).toBe('FlowState')

    expect(manifest.start_url).toBeTruthy()
    expect(manifest.start_url).toBe('/')

    expect(manifest.display).toBeTruthy()

    expect(manifest.icons).toBeDefined()
    expect(manifest.icons.length).toBeGreaterThan(0)

    // Also verify optional but important fields
    expect(manifest.description).toBeTruthy()
    expect(manifest.scope).toBeTruthy()
  })

  it('3. Icons include 192x192 and 512x512 sizes', () => {
    const iconSizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)

    // Must have 192x192 (required for Android install prompt)
    expect(iconSizes).toContain('192x192')

    // Must have 512x512 (required for splash screen)
    expect(iconSizes).toContain('512x512')

    // Should also have a maskable icon
    const maskableIcons = manifest.icons.filter(
      (icon: { purpose?: string }) => icon.purpose === 'maskable'
    )
    expect(maskableIcons.length).toBeGreaterThanOrEqual(1)
  })

  it('4. Theme color is a valid hex color', () => {
    expect(manifest.theme_color).toBeTruthy()

    // Should be a valid hex color
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    expect(hexColorRegex.test(manifest.theme_color)).toBe(true)

    // Background color should also be set for dark mode
    expect(manifest.background_color).toBeTruthy()
    expect(hexColorRegex.test(manifest.background_color)).toBe(true)
  })

  it('5. Display mode is standalone', () => {
    // PWA should use standalone display mode for app-like experience
    expect(manifest.display).toBe('standalone')

    // Verify it's not 'browser' (defeats the purpose of PWA)
    expect(manifest.display).not.toBe('browser')

    // Verify it's not 'fullscreen' (which hides status bar)
    expect(manifest.display).not.toBe('fullscreen')
  })
})
