/**
 * SVG mappings for common project emojis
 * Provides crisp, vector-based rendering for frequently used project icons
 */

export interface EmojiSvgData {
  path: string
  viewBox: string
  width: number
  height: number
  fill?: string
  colorfulSvg?: string // Complete SVG markup for colorful version
  isColorful?: boolean // Flag to indicate this emoji should be colorful
}

/**
 * SVG paths and metadata for common project emojis
 * Optimized for 14px rendering in 20px containers
 */
export const EMOJI_SVG_MAP: Record<string, EmojiSvgData> = {
  '📁': {
    path: 'M10 2L4 7v11l6-4 6 4V7l-6-5zm0 2.2L13.5 8v7.5L10 13 6.5 15.5V8l3.5-3.8z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="folderBody" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#FDE047;stop-opacity:1" /><stop offset="100%" style="stop-color:#FB923C;stop-opacity:1" /></linearGradient><linearGradient id="folderTab" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#60A5FA;stop-opacity:1" /><stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" /></linearGradient><linearGradient id="folderShadow" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FBBF24;stop-opacity:1" /><stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" /></linearGradient></defs><path d="M10 2L4 7v11l6-4 6 4V7l-6-5z" fill="url(#folderBody)" stroke="#F59E0B" stroke-width="0.5"/><path d="M10 2L4 7h6l6-5z" fill="url(#folderShadow)" stroke="#D97706" stroke-width="0.3" opacity="0.7"/><rect x="3" y="4" width="8" height="3" rx="0.5" fill="url(#folderTab)" stroke="#1E40AF" stroke-width="0.3"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '🎯': {
    path: 'M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="targetOuter"><stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" /><stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1" /></radialGradient><radialGradient id="targetMiddle"><stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" /><stop offset="100%" style="stop-color:#E5E7EB;stop-opacity:1" /></radialGradient><radialGradient id="targetInner"><stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" /><stop offset="100%" style="stop-color:#2563EB;stop-opacity:1" /></radialGradient><radialGradient id="targetCenter"><stop offset="0%" style="stop-color:#EF4444;stop-opacity:1" /><stop offset="100%" style="stop-color:#DC2626;stop-opacity:1" /></radialGradient></defs><circle cx="10" cy="10" r="8" fill="url(#targetOuter)" stroke="#1E40AF" stroke-width="0.5"/><circle cx="10" cy="10" r="6" fill="url(#targetMiddle)" stroke="#9CA3AF" stroke-width="0.3"/><circle cx="10" cy="10" r="4" fill="url(#targetInner)" stroke="#1E40AF" stroke-width="0.3"/><circle cx="10" cy="10" r="2" fill="url(#targetCenter)" stroke="#991B1B" stroke-width="0.3"/><circle cx="10" cy="4" r="1" fill="#FCD34D" stroke="#D97706" stroke-width="0.2"/><circle cx="16" cy="10" r="1" fill="#FCD34D" stroke="#D97706" stroke-width="0.2"/><circle cx="10" cy="16" r="1" fill="#FCD34D" stroke="#D97706" stroke-width="0.2"/><circle cx="4" cy="10" r="1" fill="#FCD34D" stroke="#D97706" stroke-width="0.2"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '💼': {
    path: 'M6 2H14C15.1 2 16 2.9 16 4V16C16 17.1 15.1 18 14 18H6C4.9 18 4 17.1 4 16V4C4 2.9 4.9 2 6 2zM6 4V16H14V4H6zM8 6H12V8H8V6zM8 10H12V12H8V10z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="briefcaseBody" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#4B5563;stop-opacity:1" /><stop offset="100%" style="stop-color:#1F2937;stop-opacity:1" /></linearGradient><linearGradient id="briefcaseHandle" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#9CA3AF;stop-opacity:1" /><stop offset="100%" style="stop-color:#4B5563;stop-opacity:1" /></linearGradient><linearGradient id="briefcaseClasp" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#FDE047;stop-opacity:1" /><stop offset="100%" style="stop-color:#CA8A04;stop-opacity:1" /></linearGradient></defs><rect x="4" y="6" width="12" height="10" rx="1.5" fill="url(#briefcaseBody)" stroke="#111827" stroke-width="0.5"/><path d="M7 6V4.5C7 3.67 7.67 3 8.5 3h3c0.83 0 1.5 0.67 1.5 1.5V6" fill="none" stroke="url(#briefcaseHandle)" stroke-width="0.7"/><rect x="9" y="8" width="2" height="1.5" rx="0.3" fill="url(#briefcaseClasp)" stroke="#854D0E" stroke-width="0.2"/><path d="M4 10h12" fill="none" stroke="#111827" stroke-width="0.3" opacity="0.5"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '🚀': {
    path: 'M10 2L8 8h4L10 2zm0 6C7.24 8 5 10.24 5 13s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="rocketBody" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#EF4444;stop-opacity:1" /><stop offset="100%" style="stop-color:#DC2626;stop-opacity:1" /></linearGradient><linearGradient id="rocketNose" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#F3F4F6;stop-opacity:1" /><stop offset="100%" style="stop-color:#D1D5DB;stop-opacity:1" /></linearGradient><linearGradient id="rocketWindow" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#60A5FA;stop-opacity:1" /><stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" /></linearGradient><linearGradient id="rocketFlames" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#FCD34D;stop-opacity:1" /><stop offset="50%" style="stop-color:#F97316;stop-opacity:1" /><stop offset="100%" style="stop-color:#DC2626;stop-opacity:1" /></linearGradient></defs><path d="M10 2L8 8h4L10 2z" fill="url(#rocketNose)" stroke="#9CA3AF" stroke-width="0.5"/><circle cx="10" cy="6" r="1.5" fill="url(#rocketWindow)" stroke="#1E40AF" stroke-width="0.3"/><path d="M9 8h2v2c0 1.1-0.9 2-2 2H7c-1.1 0-2-0.9-2-2s0.9-2 2-2h2zm0 4H7c-1.66 0-3 1.34-3 3s1.34 3 3 3h2c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-1 1h1v1h-1v1H8v-1H7v-1h1v1h1v-1h1v-1h-1v1z" fill="url(#rocketBody)" stroke="#991B1B" stroke-width="0.5"/><path d="M7 14c-0.5 0.5-1 1.5-1 2.5 0 0.5 0.5 1 1 1s1-0.5 1-1c0-1-0.5-2-1-2.5zm6 0c0.5 0.5 1 1.5 1 2.5 0 0.5-0.5 1-1 1s-1-0.5-1-1c0-1 0.5-2 1-2.5z" fill="url(#rocketFlames)" stroke="#DC2626" stroke-width="0.3"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '⭐': {
    path: 'M10 1l2.09 6.26L18 7.27l-5 4.87 1.18 6.88L10 15.77l-4.18 3.25L7 12.14l-5-4.87 5.91-1.99L10 1zm0 2.84l-1.45 4.31-4.31 1.45 3.15 3.07-.74 4.31 3.35-2.6 3.35 2.6-.74-4.31 3.15-3.07-4.31-1.45L10 3.84z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="starGradient"><stop offset="0%" style="stop-color:#FDE047;stop-opacity:1" /><stop offset="70%" style="stop-color:#FCD34D;stop-opacity:1" /><stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" /></radialGradient><radialGradient id="starGlow"><stop offset="0%" style="stop-color:#FEF3C7;stop-opacity:0.8" /><stop offset="100%" style="stop-color:#FDE68A;stop-opacity:0.3" /></radialGradient></defs><path d="M10 1l2.09 6.26L18 7.27l-5 4.87 1.18 6.88L10 15.77l-4.18 3.25L7 12.14l-5-4.87 5.91-1.99L10 1z" fill="url(#starGradient)" stroke="#D97706" stroke-width="0.5"/><path d="M10 1l2.09 6.26L18 7.27l-5 4.87 1.18 6.88L10 15.77l-4.18 3.25L7 12.14l-5-4.87 5.91-1.99L10 1z" fill="url(#starGlow)" stroke="none" transform="scale(1.1)" transform-origin="10 10" opacity="0.6"/><path d="M10 5l0.8 2.4h2.5l-2 1.5 0.8 2.4-2.1-1.5-2.1 1.5 0.8-2.4-2-1.5h2.5z" fill="#FFFFFF" opacity="0.7"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '🏠': {
    path: 'M10 2L2 9v9h16V9l-8-7zm6 14H4v-7l6-5.25L16 9v7zm-3-8h-2v2h2V8z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="roofGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#EF4444;stop-opacity:1" /><stop offset="100%" style="stop-color:#DC2626;stop-opacity:1" /></linearGradient><linearGradient id="wallGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" /><stop offset="100%" style="stop-color:#F3F4F6;stop-opacity:1" /></linearGradient><linearGradient id="doorGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#92400E;stop-opacity:1" /><stop offset="100%" style="stop-color:#78350F;stop-opacity:1" /></linearGradient><linearGradient id="windowGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#60A5FA;stop-opacity:1" /><stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" /></linearGradient></defs><path d="M10 2L2 9l8 7 8-7z" fill="url(#roofGradient)" stroke="#991B1B" stroke-width="0.5"/><path d="M4 9h12v9H4z" fill="url(#wallGradient)" stroke="#D1D5DB" stroke-width="0.3"/><rect x="8" y="13" width="4" height="5" rx="0.3" fill="url(#doorGradient)" stroke="#451A03" stroke-width="0.3"/><rect x="6" y="11" width="2" height="2" rx="0.2" fill="url(#windowGradient)" stroke="#1E40AF" stroke-width="0.3"/><rect x="12" y="11" width="2" height="2" rx="0.2" fill="url(#windowGradient)" stroke="#1E40AF" stroke-width="0.3"/><circle cx="10" cy="15.5" r="0.3" fill="#FDE047"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '🪣': {
    path: 'M8 2C6.9 2 6 2.9 6 4V5H4C3.4 5 3 5.4 3 6V8C3 8.6 3.4 9 4 9H5V16C5 17.1 5.9 18 7 18H13C14.1 18 15 17.1 15 16V9H16C16.6 9 17 8.6 17 8V6C17 5.4 16.6 5 16 5H14V4C14 2.9 13.1 2 12 2H8zM8 4H12V5H8V4zM7 9H13V16H7V9z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bucketGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#60A5FA;stop-opacity:1" /><stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" /></linearGradient><linearGradient id="lidGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#93C5FD;stop-opacity:1" /><stop offset="100%" style="stop-color:#60A5FA;stop-opacity:1" /></linearGradient></defs><path d="M8 2C6.9 2 6 2.9 6 4V5H4C3.4 5 3 5.4 3 6V8C3 8.6 3.4 9 4 9H5V16C5 17.1 5.9 18 7 18H13C14.1 18 15 17.1 15 16V9H16C16.6 9 17 8.6 17 8V6C17 5.4 16.6 5 16 5H14V4C14 2.9 13.1 2 12 2H8z" fill="url(#bucketGradient)" stroke="#2563EB" stroke-width="0.5"/><rect x="8" y="4" width="4" height="1" fill="url(#lidGradient)" rx="0.2"/><rect x="4" y="5" width="12" height="3" fill="url(#lidGradient)" stroke="#2563EB" stroke-width="0.5" rx="0.3"/><rect x="7" y="9" width="6" height="7" fill="#DBEAFE" stroke="#2563EB" stroke-width="0.3" rx="0.5"/></svg>',
    viewBox: '0 0 20 20',
    width: 14,
    height: 14,
    fill: 'currentColor',
    isColorful: true
  },
  '📚': {
    path: 'M4 6H2V20H18V18H4V6ZM20 2H7C5.9 2 5 2.9 5 4V14C5 15.1 5.9 16 7 16H20C21.1 16 22 15.1 22 14V4C22 2.9 21.1 2 20 2ZM20 14H7V4H20V14Z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="book1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" /><stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1" /></linearGradient><linearGradient id="book2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#10B981;stop-opacity:1" /><stop offset="100%" style="stop-color:#065F46;stop-opacity:1" /></linearGradient><linearGradient id="book3" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#F59E0B;stop-opacity:1" /><stop offset="100%" style="stop-color:#B45309;stop-opacity:1" /></linearGradient></defs><rect x="3" y="6" width="12" height="12" rx="1" fill="url(#book1)" stroke="#1E3A8A" stroke-width="0.5"/><rect x="5" y="4" width="12" height="12" rx="1" fill="url(#book2)" stroke="#064E3B" stroke-width="0.5"/><rect x="7" y="2" width="12" height="12" rx="1" fill="url(#book3)" stroke="#78350F" stroke-width="0.5"/><rect x="9" y="3" width="1" height="10" fill="rgba(255,255,255,0.2)"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
  '💡': {
    path: 'M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2Z',
    colorfulSvg: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="bulbGlow"><stop offset="0%" style="stop-color:#FDE047;stop-opacity:1" /><stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" /></radialGradient><linearGradient id="bulbBase" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#9CA3AF;stop-opacity:1" /><stop offset="100%" style="stop-color:#4B5563;stop-opacity:1" /></linearGradient></defs><path d="M10 2a6 6 0 00-6 6c0 2.5 1.5 4.5 3.5 5.5V16h5v-2.5c2-1 3.5-3 3.5-5.5a6 6 0 00-6-6z" fill="url(#bulbGlow)" stroke="#D97706" stroke-width="0.5"/><rect x="8.5" y="16.5" width="3" height="1" rx="0.2" fill="url(#bulbBase)" stroke="#374151" stroke-width="0.3"/><rect x="8" y="17.5" width="4" height="1" rx="0.2" fill="url(#bulbBase)" stroke="#374151" stroke-width="0.3"/><path d="M10 4v2m4 1.5l1.5-1.5m-11 0L6 7.5" stroke="#FFF" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/></svg>',
    viewBox: '0 0 20 20',
    width: 20,
    height: 20,
    isColorful: true
  },
}

/**
 * List of supported SVG emojis for quick checking
 */
export const SUPPORTED_SVG_EMOJIS = Object.keys(EMOJI_SVG_MAP)

/**
 * Check if an emoji has an SVG representation available
 */
export function hasSvgRepresentation(emoji: string): boolean {
  return SUPPORTED_SVG_EMOJIS.includes(emoji)
}

/**
 * Get SVG data for a specific emoji
 * Returns null if emoji is not supported
 */
export function getEmojiSvgData(emoji: string): EmojiSvgData | null {
  return EMOJI_SVG_MAP[emoji] || null
}

/**
 * Check if an emoji has a colorful SVG representation available
 */
export function hasColorfulSvgRepresentation(emoji: string): boolean {
  const data = EMOJI_SVG_MAP[emoji]
  return !!(data?.isColorful && data?.colorfulSvg)
}

/**
 * Get colorful SVG data for a specific emoji
 * Returns null if emoji doesn't have colorful SVG
 */
export function getColorfulSvgData(emoji: string): string | null {
  const data = EMOJI_SVG_MAP[emoji]
  return (data?.isColorful && data?.colorfulSvg) ? data.colorfulSvg : null
}