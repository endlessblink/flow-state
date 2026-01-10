// Type declarations for browser extension APIs
// These are used only for existence checking, not actual API calls
declare const chrome: {
  runtime?: unknown;
} | undefined;

declare const browser: {
  runtime?: unknown;
} | undefined;

/**
 * Extension Safety Utilities
 *
 * Provides safe detection and handling of browser extension APIs
 * Based on MDN WebExtensions best practices
 */

export interface ExtensionCapabilities {
  canAccessChrome: boolean;
  canAccessBrowser: boolean;
  isExtensionPresent: boolean;
  unsafeAPIsAvailable: boolean;
}

export const extensionAPI = {
  /**
   * Check if extension APIs are available in the current context
   */
  hasExtensionAPIs(): boolean {
    return typeof chrome !== 'undefined' || typeof browser !== 'undefined';
  },

  /**
   * Determine what type of extension API is available
   */
  getAPIType(): 'chrome' | 'firefox' | 'none' {
    if (typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined') {
      return 'chrome';
    }
    if (typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined') {
      return 'firefox';
    }
    return 'none';
  },

  /**
   * Get comprehensive extension capability information
   */
  getCapabilities(): ExtensionCapabilities {
    // Check what's actually available in this context
    const canAccessChrome = typeof chrome !== 'undefined' &&
                            typeof chrome.runtime !== 'undefined';

    const canAccessBrowser = typeof browser !== 'undefined' &&
                             typeof browser.runtime !== 'undefined';

    // Extensions indicate their presence through specific APIs
    const isExtensionPresent = canAccessChrome || canAccessBrowser;

    // Some extensions inject unsafe globals or check for specific markers
    const unsafeAPIsAvailable = typeof chrome !== 'undefined' ||
                                typeof browser !== 'undefined';

    return {
      canAccessChrome,
      canAccessBrowser,
      isExtensionPresent,
      unsafeAPIsAvailable
    };
  },

  /**
   * Safely attempt to call an extension API function
   * Only use this if your app actually needs to call extension APIs (rare)
   */
  async safeExtensionCall<T>(
    action: () => Promise<T>,
    fallback: T,
    options?: {
      timeout?: number;
      context?: string;
    }
  ): Promise<T> {
    const { timeout = 1000, context = 'unknown' } = options || {};

    try {
      // Create a timeout race condition
      const timeoutPromise = new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Extension API timeout')), timeout)
      );

      return await Promise.race([action(), timeoutPromise]);
    } catch (error) {
      console.warn(
        `Extension API call failed in ${context}:`,
        error instanceof Error ? error.message : String(error)
      );
      return fallback;
    }
  }
};

/**
 * Log extension compatibility information for debugging
 */
export function logExtensionInfo(): void {
  const capabilities = extensionAPI.getCapabilities();
  const apiType = extensionAPI.getAPIType();

  console.info('🔌 Extension Compatibility Info:', {
    apiType,
    capabilities,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString()
  });
}

/**
 * Check if we're running in a context that commonly has extension issues
 */
export function isProblematicContext(): boolean {
  // Firefox with Bitwarden is the primary issue
  const isFirefox = typeof navigator !== 'undefined' &&
                   navigator.userAgent.toLowerCase().includes('firefox');

  return isFirefox && !extensionAPI.hasExtensionAPIs();
}