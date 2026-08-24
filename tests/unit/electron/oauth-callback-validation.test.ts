import { describe, expect, it } from 'vitest'
import { isOAuthCallbackUrl } from '../../../electron/ipc/oauthValidation'

describe('Electron OAuth callback validation', () => {
  it('ignores stray loopback requests until a code or provider result arrives', () => {
    expect(isOAuthCallbackUrl('http://127.0.0.1:24892/')).toBe(false)
    expect(isOAuthCallbackUrl('http://127.0.0.1:24892/favicon.ico')).toBe(false)
    expect(isOAuthCallbackUrl('http://127.0.0.1:24892/?code=auth-code')).toBe(true)
    expect(isOAuthCallbackUrl('http://127.0.0.1:24892/?error=access_denied')).toBe(true)
  })

  it('recognizes the supported implicit callback payload shape', () => {
    expect(
      isOAuthCallbackUrl('http://127.0.0.1:24892/#access_token=access&refresh_token=refresh'),
    ).toBe(true)
  })
})
