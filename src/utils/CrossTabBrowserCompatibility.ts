/**
 * Cross Tab Browser Compatibility
 *
 * Ensures cross-tab synchronization works across different browsers
 * by handling browser-specific APIs, limitations, and fallbacks.
 */

export interface BrowserCapabilities {
  broadcastChannel: boolean
  localStorage: boolean
  sessionStorage: boolean
  indexedDB: boolean
  serviceWorker: boolean
  sharedWorker: boolean
}

export interface CompatibilityConfig {
  fallbackStrategy: 'localStorage' | 'sessionStorage' | 'none'
  enablePolling: boolean
  pollingInterval: number
  maxRetries: number
  retryDelay: number
}

export interface CompatibilityInfo {
  browser: string
  version: string
  capabilities: BrowserCapabilities
  recommendedStrategy: string
  warnings: string[]
}

export class CrossTabBrowserCompatibility {
  private config: CompatibilityConfig
  private capabilities: BrowserCapabilities
  private browserInfo: CompatibilityInfo
  private pollingTimer: number | null = null
  private retryCount: number = 0

  constructor(config: Partial<CompatibilityConfig> = {}) {
    this.config = {
      fallbackStrategy: config.fallbackStrategy || 'localStorage',
      enablePolling: config.enablePolling !== undefined ? config.enablePolling : true,
      pollingInterval: config.pollingInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    }

    this.capabilities = this.detectCapabilities()
    this.browserInfo = this.getBrowserInfo()
  }

  /**
   * Get the best available communication channel for this browser
   */
  getBestChannel(): BroadcastChannel | Storage | null {
    // Priority order: BroadcastChannel > SharedWorker > Storage > Polling
    if (this.capabilities.broadcastChannel) {
      try {
        return new BroadcastChannel('pomo-flow-sync')
      } catch (_error) {
        console.warn('BroadcastChannel creation failed, falling back')
      }
    }

    if (this.capabilities.sharedWorker) {
      try {
        return this.createSharedWorkerChannel()
      } catch (_error) {
        console.warn('SharedWorker creation failed, falling back')
      }
    }

    if (this.capabilities.localStorage) {
      return window.localStorage
    }

    if (this.capabilities.sessionStorage) {
      return window.sessionStorage
    }

    if (this.config.enablePolling) {
      this.startPolling()
      return this.createPollingChannel()
    }

    return null
  }

  /**
   * Check if the current browser supports all required features
   */
  isCompatible(): boolean {
    return !!(this.capabilities.broadcastChannel ||
             this.capabilities.localStorage ||
             this.capabilities.sessionStorage ||
             this.config.enablePolling)
  }

  /**
   * Get detailed browser compatibility information
   */
  getCompatibilityInfo(): CompatibilityInfo {
    return { ...this.browserInfo }
  }

  /**
   * Test the communication channel and provide fallbacks
   */
  async testChannel(channel: BroadcastChannel | MessageChannel | Storage): Promise<boolean> {
    const testMessage = {
      id: 'compatibility-test',
      timestamp: Date.now(),
      data: 'test'
    }

    try {
      if (channel instanceof BroadcastChannel) {
        return await this.testBroadcastChannel(channel, testMessage)
      } else if (channel === window.localStorage || channel === window.sessionStorage) {
        return await this.testStorageChannel(channel as Storage, testMessage)
      } else {
        return false
      }
    } catch (error) {
      console.warn('Channel test failed:', error)
      return false
    }
  }

  /**
   * Get recommended configuration for this browser
   */
  getRecommendedConfig(): CompatibilityConfig {
    const config: CompatibilityConfig = { ...this.config }

    // Adjust settings based on browser capabilities
    if (this.browserInfo.browser === 'Safari') {
      // Safari has issues with BroadcastChannel in some versions
      if (this.capabilities.localStorage) {
        config.fallbackStrategy = 'localStorage'
      }
    }

    if (this.browserInfo.browser === 'Firefox') {
      // Firefox might need longer polling intervals
      config.pollingInterval = 2000
    }

    if (this.capabilities.broadcastChannel) {
      config.enablePolling = false // No need for polling if BroadcastChannel works
    }

    return config
  }

  /**
   * Detect current browser capabilities
   */
  private detectCapabilities(): BrowserCapabilities {
    return {
      broadcastChannel: typeof BroadcastChannel !== 'undefined',
      localStorage: this.testLocalStorage(),
      sessionStorage: this.testSessionStorage(),
      indexedDB: typeof indexedDB !== 'undefined',
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      sharedWorker: typeof SharedWorker !== 'undefined'
    }
  }

  /**
   * Get detailed browser information
   */
  private getBrowserInfo(): CompatibilityInfo {
    const userAgent = navigator.userAgent
    let browser = 'Unknown'
    let version = 'Unknown'

    // Basic browser detection
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome'
      version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown'
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox'
      version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown'
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari'
      version = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown'
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge'
      version = userAgent.match(/Edg\/(\d+)/)?.[1] || 'Unknown'
    }

    const warnings: string[] = []

    // Add warnings for known compatibility issues
    if (browser === 'Safari' && parseInt(version) < 14) {
      warnings.push('Safari versions < 14 may have BroadcastChannel issues')
    }

    if (!this.capabilities.broadcastChannel && !this.capabilities.localStorage) {
      warnings.push('Limited cross-tab communication capabilities')
    }

    const recommendedStrategy = this.capabilities.broadcastChannel ? 'BroadcastChannel' :
                                this.capabilities.localStorage ? 'localStorage' :
                                this.capabilities.sessionStorage ? 'sessionStorage' :
                                'polling'

    return {
      browser,
      version,
      capabilities: this.capabilities,
      recommendedStrategy,
      warnings
    }
  }

  /**
   * Test localStorage availability and quota
   */
  private testLocalStorage(): boolean {
    try {
      const testKey = 'pomo-flow-compatibility-test'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * Test sessionStorage availability
   */
  private testSessionStorage(): boolean {
    try {
      const testKey = 'pomo-flow-compatibility-test'
      sessionStorage.setItem(testKey, 'test')
      sessionStorage.removeItem(testKey)
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * Test BroadcastChannel communication
   */
  private async testBroadcastChannel(channel: BroadcastChannel, testMessage: { id: string; timestamp: number; data: string }): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        channel.close()
        resolve(false)
      }, 1000)

      const handleMessage = (event: MessageEvent) => {
        if (event.data.id === testMessage.id) {
          clearTimeout(timeout)
          channel.removeEventListener('message', handleMessage)
          channel.close()
          resolve(true)
        }
      }

      channel.addEventListener('message', handleMessage)
      channel.postMessage(testMessage)
    })
  }

  /**
   * Test storage-based communication
   */
  private async testStorageChannel(storage: Storage, testMessage: any): Promise<boolean> {
    const testKey = 'pomo-flow-compatibility-test'

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        storage.removeItem(testKey)
        resolve(false)
      }, 1000)

      const handleStorage = (event: StorageEvent) => {
        if (event.key === testKey && event.newValue === JSON.stringify(testMessage)) {
          clearTimeout(timeout)
          window.removeEventListener('storage', handleStorage)
          storage.removeItem(testKey)
          resolve(true)
        }
      }

      window.addEventListener('storage', handleStorage)
      storage.setItem(testKey, JSON.stringify(testMessage))
    })
  }

  /**
   * Create SharedWorker-based communication channel
   */
  private createSharedWorkerChannel(): any {
    // This is a simplified implementation
    // In a real implementation, you would create and manage a SharedWorker
    return null
  }

  /**
   * Create polling-based communication channel
   */
  private createPollingChannel(): any {
    return {
      postMessage: (data: any) => {
        localStorage.setItem('pomo-flow-polling', JSON.stringify(data))
      },
      addEventListener: (_event: string, handler: (event: MessageEvent) => void) => {
        this.startPolling(handler)
      },
      close: () => {
        this.stopPolling()
      }
    }
  }

  /**
   * Start polling for changes
   */
  private startPolling(handler?: (event: MessageEvent) => void): void {
    if (this.pollingTimer) return

    let lastData = localStorage.getItem('pomo-flow-polling')

    this.pollingTimer = setInterval(() => {
      const currentData = localStorage.getItem('pomo-flow-polling')
      if (currentData !== lastData && handler) {
        try {
          handler({ data: JSON.parse(currentData || '{}') } as MessageEvent)
        } catch (error) {
          console.warn('Failed to parse polling data:', error)
        }
        lastData = currentData
      }
    }, this.config.pollingInterval) as unknown as number
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPolling()
  }
}

export default CrossTabBrowserCompatibility