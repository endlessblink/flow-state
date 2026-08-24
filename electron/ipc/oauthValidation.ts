export function isOAuthCallbackUrl(callbackUrl: string): boolean {
  try {
    const parsed = new URL(callbackUrl)
    return Boolean(
      parsed.searchParams.get('code') ||
      parsed.searchParams.get('error') ||
      parsed.searchParams.get('access_token') ||
      parsed.searchParams.get('refresh_token') ||
      parsed.hash.includes('access_token=') ||
      parsed.hash.includes('refresh_token=') ||
      parsed.hash.includes('error=')
    )
  } catch {
    return false
  }
}
