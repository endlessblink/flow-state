import { describe, expect, it } from 'vitest'
import { toSupabaseUserSettings } from '@/utils/supabaseMappers'
import type { AppSettings } from '@/stores/settings'

describe('user settings mapper', () => {
  it('does not serialize provider credentials or API keys into shared settings', () => {
    const settings = {
      googleProviderToken: 'access-secret',
      googleProviderRefreshToken: 'refresh-secret',
      googleProviderTokenExpiry: 123,
      groqApiKey: 'groq-secret',
      googleConnected: true,
      googleCalendars: [],
    } as unknown as AppSettings

    const payload = toSupabaseUserSettings(settings, 'user-1')

    expect(payload.settings).not.toHaveProperty('googleProviderToken')
    expect(payload.settings).not.toHaveProperty('googleProviderRefreshToken')
    expect(payload.settings).not.toHaveProperty('googleProviderTokenExpiry')
    expect(payload.settings).not.toHaveProperty('groqApiKey')
    expect(payload.settings).toMatchObject({ googleConnected: true, googleCalendars: [] })
  })
})
