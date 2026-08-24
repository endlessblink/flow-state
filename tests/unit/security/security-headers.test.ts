import { describe, expect, it } from 'vitest'
import { DEFAULT_SECURITY_CONFIG } from '@/utils/securityHeaders'

describe('security header policy', () => {
  it('keeps the morning dashboard and calendar API origins aligned with the shared connect policy', () => {
    const connectSources = DEFAULT_SECURITY_CONFIG.contentSecurityPolicy.directives['connect-src']

    expect(connectSources).toContain('https://hn.algolia.com')
    expect(connectSources).toContain('https://www.googleapis.com')
  })
})
