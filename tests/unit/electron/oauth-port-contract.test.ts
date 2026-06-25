import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const expectedPorts = ['24892', '24893', '24894']

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Electron OAuth loopback port contract', () => {
  it('uses the same Google/Supabase allow-listed ports as Tauri and docs', () => {
    const electronOAuth = read('electron/ipc/oauth.ts')
    const tauriOAuth = read('src/composables/useTauriOAuth.ts')
    const setupDocs = read('docs/GOOGLE-CLOUD-SETUP.md')

    for (const port of expectedPorts) {
      expect(electronOAuth).toContain(port)
      expect(tauriOAuth).toContain(port)
      expect(setupDocs).toContain(`http://127.0.0.1:${port}`)
    }

    expect(electronOAuth).not.toMatch(/2489[567]/)
  })
})
