/**
 * TASK-1219: Time Block Progress Notifications
 * Type definitions for calendar time block milestone alerts
 */

export interface TimeBlockMilestone {
  id: string                   // 'halfway', '1min-before', 'ended', or custom
  type: 'percentage' | 'before-end' | 'at-end'
  value: number                // % of duration OR minutes-before-end
  label: string                // Human-readable label
  enabled: boolean
}

export interface TimeBlockNotificationSettings {
  enabled: boolean
  milestones: TimeBlockMilestone[]
  deliveryChannels: {
    inAppToast: boolean
    osNotification: boolean
    sound: boolean
  }
  respectDoNotDisturb: boolean
}

export interface TimeBlockNotificationOverride {
  enabled?: boolean
  milestones?: Partial<TimeBlockMilestone>[]
  deliveryChannels?: Partial<TimeBlockNotificationSettings['deliveryChannels']>
}

export const DEFAULT_MILESTONES: TimeBlockMilestone[] = [
  {
    id: 'halfway',
    type: 'percentage',
    value: 50,
    label: 'Halfway through',
    enabled: true
  },
  {
    id: '1min-before',
    type: 'before-end',
    value: 1,
    label: '1 minute before end',
    enabled: true
  },
  {
    id: 'ended',
    type: 'at-end',
    value: 0,
    label: 'Time block ended',
    enabled: true
  }
]

export const DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS: TimeBlockNotificationSettings = {
  enabled: true,
  milestones: DEFAULT_MILESTONES,
  deliveryChannels: {
    inAppToast: true,
    osNotification: true,
    sound: true
  },
  respectDoNotDisturb: true
}
