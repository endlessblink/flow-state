/**
 * Timezone and Locale Compatibility Manager
 * Ensures consistent time handling across different devices, browsers, and timezones
 */

export interface TimezoneInfo {
  timezone: string
  offset: number
  isDST: boolean
  locale: string
  browser: string
  platform: string
}

export interface NormalizedTimestamp {
  iso: string           // ISO 8601 format
  utc: number          // Unix timestamp in milliseconds
  local: string        // Localized string representation
  timezone: string     // Original timezone
  offset: number       // Original offset in minutes
  deviceSignature: string // Device fingerprint for origin tracking
}

export interface SyncMetadata {
  deviceId: string
  origin: {
    timestamp: NormalizedTimestamp
    device: TimezoneInfo
  }
  lastModified: {
    timestamp: NormalizedTimestamp
    device: TimezoneInfo
  }
  version: number
}

export class TimezoneCompatibilityManager {
  private static instance: TimezoneCompatibilityManager
  private deviceId: string
  private timezoneInfo: TimezoneInfo

  private constructor() {
    this.deviceId = this.generateDeviceId()
    this.timezoneInfo = this.getTimezoneInfo()
  }

  public static getInstance(): TimezoneCompatibilityManager {
    if (!TimezoneCompatibilityManager.instance) {
      TimezoneCompatibilityManager.instance = new TimezoneCompatibilityManager()
    }
    return TimezoneCompatibilityManager.instance
  }

  /**
   * Get device-specific timezone information
   */
  private getTimezoneInfo(): TimezoneInfo {
    const now = new Date()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const locale = Intl.DateTimeFormat().resolvedOptions().locale

    // Get timezone offset
    const offset = now.getTimezoneOffset()

    // Check for DST
    const winter = new Date(now.getFullYear(), 0, 1)
    const summer = new Date(now.getFullYear(), 6, 1)
    const isDST = now.getTimezoneOffset() < Math.max(winter.getTimezoneOffset(), summer.getTimezoneOffset())

    return {
      timezone,
      offset,
      isDST,
      locale,
      browser: this.getBrowserInfo(),
      platform: navigator.platform || 'unknown'
    }
  }

  /**
   * Generate unique device identifier
   */
  private generateDeviceId(): string {
    // Create fingerprint from various browser characteristics
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    let fingerprint = ''

    try {
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('Device fingerprint', 2, 2)
        fingerprint = canvas.toDataURL().slice(-50) // Last 50 chars
      }
    } catch {
      console.warn('Could not generate canvas fingerprint')
    }

    // Additional fingerprint data
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      fingerprint,
      Math.random().toString(36).substr(2, 9)
    ]

    // Create hash
    let hash = 0
    const str = components.join('|')
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    return 'device_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36)
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): string {
    const ua = navigator.userAgent

    if (ua.includes('Firefox')) return 'firefox'
    if (ua.includes('Chrome')) return 'chrome'
    if (ua.includes('Safari')) return 'safari'
    if (ua.includes('Edge')) return 'edge'
    if (ua.includes('Opera')) return 'opera'

    return 'unknown'
  }

  /**
   * Normalize timestamp for cross-device compatibility
   */
  public normalizeTimestamp(date: Date | string | number): NormalizedTimestamp {
    const dateObj = new Date(date)

    // Validate date
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date provided for normalization')
    }

    return {
      iso: dateObj.toISOString(),
      utc: dateObj.getTime(),
      local: dateObj.toLocaleString(this.timezoneInfo.locale),
      timezone: this.timezoneInfo.timezone,
      offset: this.timezoneInfo.offset,
      deviceSignature: this.deviceId
    }
  }

  /**
   * Convert normalized timestamp to local device time
   */
  public toLocalTime(normalized: NormalizedTimestamp): Date {
    return new Date(normalized.utc)
  }

  /**
   * Create sync metadata for document
   */
  public createSyncMetadata(existing?: Partial<SyncMetadata>): SyncMetadata {
    const now = new Date()
    const normalizedNow = this.normalizeTimestamp(now)

    return {
      deviceId: this.deviceId,
      origin: existing?.origin || {
        timestamp: normalizedNow,
        device: this.timezoneInfo
      },
      lastModified: {
        timestamp: normalizedNow,
        device: this.timezoneInfo
      },
      version: (existing?.version || 0) + 1
    }
  }

  /**
   * Update sync metadata when document is modified
   */
  public updateSyncMetadata(metadata: SyncMetadata): SyncMetadata {
    const now = new Date()
    const normalizedNow = this.normalizeTimestamp(now)

    return {
      ...metadata,
      lastModified: {
        timestamp: normalizedNow,
        device: this.timezoneInfo
      },
      version: metadata.version + 1
    }
  }

  /**
   * Compare timestamps from different devices
   */
  public compareTimestamps(
    ts1: NormalizedTimestamp,
    ts2: NormalizedTimestamp
  ): 'greater' | 'less' | 'equal' {
    if (ts1.utc > ts2.utc) return 'greater'
    if (ts1.utc < ts2.utc) return 'less'
    return 'equal'
  }

  /**
   * Detect potential timezone conflicts
   */
  public detectTimezoneConflict(metadata1: SyncMetadata, metadata2: SyncMetadata): {
    hasConflict: boolean
    details: string
  } {
    const tz1 = metadata1.lastModified.device.timezone
    const tz2 = metadata2.lastModified.device.timezone

    if (tz1 !== tz2) {
      const offset1 = metadata1.lastModified.device.offset
      const offset2 = metadata2.lastModified.device.offset
      const offsetDiff = Math.abs(offset1 - offset2)

      if (offsetDiff > 60) { // More than 1 hour difference
        return {
          hasConflict: true,
          details: `Significant timezone difference detected: ${tz1} (${offset1}min) vs ${tz2} (${offset2}min)`
        }
      }
    }

    return { hasConflict: false, details: 'No timezone conflicts detected' }
  }

  /**
   * Get device compatibility report
   */
  public getCompatibilityReport(): {
    deviceId: string
    timezone: TimezoneInfo
    capabilities: {
      timezoneSupport: boolean
      localeSupport: boolean
      dstAwareness: boolean
      canvasFingerprinting: boolean
    }
  } {
    const _testDate = new Date()
    const supportsTimezone = !!Intl.DateTimeFormat().resolvedOptions().timeZone
    const supportsLocale = !!Intl.DateTimeFormat().resolvedOptions().locale

    // Test DST awareness
    const dstAware = this.timezoneInfo.isDST

    return {
      deviceId: this.deviceId,
      timezone: this.timezoneInfo,
      capabilities: {
        timezoneSupport: supportsTimezone,
        localeSupport: supportsLocale,
        dstAwareness: dstAware,
        canvasFingerprinting: !!document.createElement('canvas').getContext
      }
    }
  }

  /**
   * Format timestamp for display in different locales
   */
  public formatForDisplay(
    timestamp: NormalizedTimestamp,
    targetLocale?: string,
    options?: Intl.DateTimeFormatOptions
  ): string {
    const locale = targetLocale || this.timezoneInfo.locale
    const date = new Date(timestamp.utc)

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }

    return date.toLocaleString(locale, options || defaultOptions)
  }

  /**
   * Validate timezone compatibility between devices
   */
  public validateCompatibility(otherDevice: TimezoneInfo): {
    isCompatible: boolean
    warnings: string[]
    recommendations: string[]
  } {
    const warnings: string[] = []
    const recommendations: string[] = []

    // Check timezone support
    if (!otherDevice.timezone) {
      warnings.push('Device does not support timezone detection')
      recommendations.push('Consider using UTC timestamps for this device')
    }

    // Check locale support
    if (!otherDevice.locale) {
      warnings.push('Device does not support locale detection')
      recommendations.push('Use default locale formatting')
    }

    // Check for large timezone differences
    const offsetDiff = Math.abs(this.timezoneInfo.offset - otherDevice.offset)
    if (offsetDiff > 720) { // More than 12 hours
      warnings.push('Large timezone difference detected (>12 hours)')
      recommendations.push('Always display timestamps with timezone information')
    }

    // Check browser compatibility
    const supportedBrowsers = ['chrome', 'firefox', 'safari', 'edge']
    if (!supportedBrowsers.includes(otherDevice.browser)) {
      warnings.push(`Unsupported browser: ${otherDevice.browser}`)
      recommendations.push('Test sync functionality thoroughly on this browser')
    }

    return {
      isCompatible: warnings.length === 0,
      warnings,
      recommendations
    }
  }

  /**
   * Get current device info
   */
  public getDeviceInfo(): { deviceId: string; timezone: TimezoneInfo } {
    return {
      deviceId: this.deviceId,
      timezone: this.timezoneInfo
    }
  }
}

// Export singleton instance
export const getTimezoneManager = () => TimezoneCompatibilityManager.getInstance()

// Export types for use in other modules
// Types already exported as interfaces above