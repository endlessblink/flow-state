import { describe, expect, it } from 'vitest'
import { assertSafeExternalUrl } from '../../../electron/ipc/security'

describe('Electron IPC security boundaries', () => {
  it('accepts HTTPS OAuth/provider URLs', () => {
    expect(assertSafeExternalUrl('https://accounts.google.com/o/oauth2/auth')).toBe(
      'https://accounts.google.com/o/oauth2/auth',
    )
  })

  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,<script>alert(1)</script>',
    'http://127.0.0.1:5577/private',
  ])('rejects unsafe external URL %s', (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow('Only public HTTPS URLs may be opened externally')
  })
})
