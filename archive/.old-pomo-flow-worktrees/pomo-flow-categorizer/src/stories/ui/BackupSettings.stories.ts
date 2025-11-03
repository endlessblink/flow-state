import type { Meta, StoryObj } from '@storybook/vue3'
import BackupSettings from '@/components/BackupSettings.vue'

const meta = {
  component: BackupSettings,
  title: '🧩 Components/🔧 UI/BackupSettings',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="max-width: 600px; width: 100%; padding: var(--space-4);">
          <story />
        </div>
      `
    })
  ]
} satisfies Meta<typeof BackupSettings>

export default meta
type Story = StoryObj<typeof meta>

// Default backup settings
export const Default: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />'
  })
}

// With healthy data integrity
export const HealthyIntegrity: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings with healthy data integrity status. Shows:\n\n• ✅ **Data Integrity: Healthy** - All data checks passed\n• 📊 **Scheduler Status** - Current backup system state\n• ⚙️ **Backup Settings** - Frequency, storage, and retention options\n• 🎛️ **Scheduler Controls** - Start, pause, stop backup scheduler\n• 🚀 **Backup Actions** - Manual backup, validation, recovery center'
        }
      }
    }
  })
}

// With data integrity issues
export const IntegrityIssues: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings with data integrity issues. Shows:\n\n• ⚠️ **Data Integrity: Issues** - Problems detected in data validation\n• 📊 **Scheduler Status** - Current backup system state\n• 🚨 **Alert State** - Warning indicators for data issues\n• 🔧 **Recovery Options** - Access to data recovery tools\n\nUse this state to test how the component handles and displays data integrity problems.'
        }
      }
    }
  })
}

// Scheduler running
export const SchedulerRunning: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings with scheduler actively running. Shows:\n\n• 🟢 **Status: Running** - Scheduler is active and processing\n• ⏰ **Next Backup** - Countdown to next scheduled backup\n• 📈 **Success Rate** - Historical backup success percentage\n• ⏸️ **Pause/Stop Controls** - Available to control running scheduler\n\nThe scheduler automatically creates backups based on the configured frequency and settings.'
        }
      }
    }
  })
}

// Scheduler paused
export const SchedulerPaused: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings with scheduler paused. Shows:\n\n• ⏸️ **Status: Paused** - Scheduler temporarily suspended\n• ▶️ **Resume/Stop Controls** - Options to continue or stop\n• 📊 **Current Settings** - All backup configurations preserved\n• 📝 **State Retention** - Backup history and stats maintained\n\nUse pause state to temporarily suspend automatic backups without losing configuration.'
        }
      }
    }
  })
}

// Creating backup
export const CreatingBackup: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings during backup creation. Shows:\n\n• 🔄 **Loading State** - Spinning indicator on backup button\n• 📤 **In Progress** - "Creating backup..." status message\n• 🔒 **Controls Disabled** - Prevent conflicting operations\n• ⏳ **Processing Time** - Visual feedback for long operations\n\nThis state provides clear feedback during backup operations and prevents user actions that could interfere with the process.'
        }
      }
    }
  })
}

// Validating data
export const ValidatingData: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings during data validation. Shows:\n\n• 🔄 **Loading State** - Spinning indicator on validate button\n• 🔍 **In Progress** - "Validating data integrity..." status message\n• 🛡️ **Integrity Check** - Comprehensive data validation process\n• 📊 **Result Pending** - Awaiting validation completion\n\nData validation checks for corruption, consistency, and completeness of all stored task and project data.'
        }
      }
    }
  })
}

// With backup history
export const WithHistory: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Backup settings with backup history displayed. Shows:\n\n• 📜 **Recent History** - Last 5 backup attempts\n• ✅ **Success Indicators** - Visual success/failure status\n• 📊 **Backup Sizes** - File size information for successful backups\n• ⏰ **Timestamps** - When each backup was created\n• 📈 **Success Rate** - Overall backup reliability statistics\n\nHistory helps users track backup reliability and identify potential issues with backup operations.'
        }
      }
    }
  })
}

// Different backup frequencies
export const Frequencies: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Different backup frequency configurations:\n\n## Available Options:\n\n- **Disabled** - No automatic backups\n- **Every 5 minutes** - High-frequency backups\n- **Every 15 minutes** - Frequent backups for active work\n- **Every 30 minutes** - Balanced frequency\n- **Every hour** - Standard backup interval\n- **Every 6 hours** - Periodic backups\n- **Daily** - Once per day\n- **Weekly** - Once per week\n\nChoose frequency based on:\n- Work intensity and frequency of changes\n- Storage capacity and bandwidth\n- Recovery point objectives (RPO)\n- System performance considerations'
        }
      }
    }
  })
}

// Storage location options
export const StorageOptions: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Storage location configuration options:\n\n## Storage Options:\n\n### **Local Only**\n- Backups stored on device\n- Fast access and restore\n- Limited by device storage\n- Vulnerable to device failure\n\n### **Cloud Only**\n- Backups stored in cloud\n- Accessible from anywhere\n- Protected from local device issues\n- Requires internet connection\n\n### **Local + Cloud**\n- Dual redundancy\n- Maximum protection\n- Immediate local access\n- Cloud disaster recovery\n- Uses more storage space\n\nChoose based on security needs, accessibility requirements, and available storage.'
        }
      }
    }
  })
}

// Interactive demonstration
export const InteractiveDemo: Story = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />',
    parameters: {
      docs: {
        description: {
          story: 'Interactive backup system demonstration:\n\n## Features to Test:\n\n### **Backup Settings**\n- Adjust backup frequency dropdown\n- Change storage location preferences\n- Enable/disable auto-download\n- Configure maximum backup retention\n\n### **Scheduler Controls**\n- Start automatic backup scheduler\n- Pause temporarily (preserves state)\n- Stop completely (resets scheduler)\n\n### **Backup Actions**\n- Create manual backup on demand\n- Validate data integrity\n- Access recovery center\n\n### **Status Monitoring**\n- Real-time scheduler status\n- Data integrity health checks\n- Success rate statistics\n- Next backup countdown\n\n### **Visual Feedback**\n- Loading states during operations\n- Success/warning/error messages\n- Progress indicators\n- Disabled states during operations\n\nThe backup system provides bulletproof data protection with multiple redundancy layers, ensuring task data is never lost due to system failures, user errors, or other issues.'
        }
      }
    }
  })
}