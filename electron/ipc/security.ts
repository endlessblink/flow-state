const UNSAFE_EXTERNAL_URL_MESSAGE = 'Only public HTTPS URLs may be opened externally'

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.')
  if (octets.length !== 4 || octets.some((octet) => !/^\d+$/.test(octet))) return false

  const [first, second] = octets.map(Number)
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  )
}

export function assertSafeExternalUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(UNSAFE_EXTERNAL_URL_MESSAGE)
  }

  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:' ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === '::1' ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error(UNSAFE_EXTERNAL_URL_MESSAGE)
  }

  return url.toString()
}
