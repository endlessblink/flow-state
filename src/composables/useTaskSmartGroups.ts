/**
 * @deprecated This file has been renamed to usePowerKeywords.ts for clarity.
 * Please update your imports to use '@/composables/usePowerKeywords' instead.
 *
 * This re-export exists for backwards compatibility and will be removed in a future release.
 */

// Re-export everything from the new location
export {
  // Constants
  SMART_GROUPS,
  PRIORITY_KEYWORDS,
  STATUS_KEYWORDS,
  DURATION_KEYWORDS,
  DAY_OF_WEEK_KEYWORDS,

  // Types
  type SmartGroupType,
  type PowerKeywordCategory,
  type PowerKeywordResult,

  // Functions
  detectPowerKeyword,
  isPowerGroup,
  getAllPowerKeywords,
  isSmartGroup,
  getSmartGroupType,
  getSmartGroupDate,
  applySmartGroupProperties,
  shouldUseSmartGroupLogic
} from './usePowerKeywords'
