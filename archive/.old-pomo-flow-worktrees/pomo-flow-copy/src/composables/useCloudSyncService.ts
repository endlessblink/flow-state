/**
 * SERVICE-ORCHESTRATOR-BASED CLOUD SYNC
 *
 * Enhanced cloud sync that integrates with ServiceOrchestrator for data access.
 * Provides cross-device synchronization through the unified service layer.
 */

import { ref, watch } from 'vue'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'

// Cloud sync providers (same as original)
interface CloudProvider {
  name: string
  endpoint: string
  headers?: Record<string, string>
  upload: (data: any) => Promise<{ id: string; url: string }>
  download: (id: string) => Promise<any>
}

// JSONBin provider
const JSONBinProvider: CloudProvider = {
  name: 'JSONBin',
  endpoint: 'https://api.jsonbin.io/v3/bins',
  headers: {
    'Content-Type': 'application/json',
  },
  async upload(data: any) {
    const apiKey = localStorage.getItem('jsonbin-api-key')
    if (!apiKey) {
      throw new Error('JSONBin API key required. Set it with: localStorage.setItem("jsonbin-api-key", "your-key")')
    }

    const response = await fetch('https://api.jsonbin.io/v3/bins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': apiKey,
        'X-Bin-Name': `pomo-flow-backup-${new Date().toISOString().split('T')[0]}`,
        'X-Bin-Private': 'false'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to upload to JSONBin (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    return { id: result.id, url: `https://api.jsonbin.io/v3/bins/${result.id}` }
  },
  async download(id: string) {
    const apiKey = localStorage.getItem('jsonbin-api-key')
    if (!apiKey) {
      throw new Error('JSONBin API key required. Set it with: localStorage.setItem("jsonbin-api-key", "your-key")')
    }

    const response = await fetch(`https://api.jsonbin.io/v3/bins/${id}`, {
      headers: {
        'X-Master-Key': apiKey
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to download from JSONBin (${response.status}): ${errorText}`)
    }

    return await response.json()
  }
}

// GitHub Gist provider
const GitHubGistProvider: CloudProvider = {
  name: 'GitHub Gist',
  endpoint: 'https://api.github.com/gists',
  headers: {},
  async upload(data: any) {
    const token = localStorage.getItem('github-token')
    if (!token) throw new Error('GitHub token required')

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: `Pomo-Flow Backup - ${new Date().toISOString()}`,
        public: false,
        files: {
          'tasks.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    })
    if (!response.ok) throw new Error('Failed to upload to GitHub Gist')
    const result = await response.json()
    return { id: result.id, url: result.html_url }
  },
  async download(id: string) {
    const token = localStorage.getItem('github-token')
    if (!token) throw new Error('GitHub token required')

    const response = await fetch(`https://api.github.com/gists/${id}`, {
      headers: { 'Authorization': `token ${token}` }
    })
    if (!response.ok) throw new Error('Failed to download from GitHub Gist')
    const gist = await response.json()

    const tasksFile = gist.files['tasks.json']
    if (tasksFile) {
      return JSON.parse(tasksFile.content)
    }
    throw new Error('No tasks.json file found in gist')
  }
}

class CloudSyncServiceManager {
  private serviceOrchestrator: any
  private provider: CloudProvider
  private syncUrl: string | null = null
  private lastSyncTime: number = 0
  private syncInterval: number = 5 * 60 * 1000 // 5 minutes
  private isOnline: boolean = navigator.onLine
  private syncTimer: NodeJS.Timeout | null = null
  private warnedAboutMissingKey: boolean = false

  constructor(serviceOrchestrator: any) {
    this.serviceOrchestrator = serviceOrchestrator
    this.provider = JSONBinProvider
    this.loadSyncState()
    this.setupNetworkListeners()
    this.startPeriodicSync()
  }

  private loadSyncState() {
    const savedProvider = localStorage.getItem('pomo-cloud-provider')
    if (savedProvider === 'github') {
      this.provider = GitHubGistProvider
    }

    const savedUrl = localStorage.getItem('pomo-cloud-sync-url')
    if (savedUrl) {
      this.syncUrl = savedUrl
    }

    const savedTime = localStorage.getItem('pomo-cloud-last-sync')
    if (savedTime) {
      this.lastSyncTime = parseInt(savedTime, 10)
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      console.log('🌐 Back online - resuming cloud sync')
      this.syncNow()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('📴 Offline - cloud sync paused')
    })
  }

  private startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        this.syncNow()
      }
    }, this.syncInterval)
  }

  private saveSyncState() {
    localStorage.setItem('pomo-cloud-provider', this.provider.name)
    if (this.syncUrl) {
      localStorage.setItem('pomo-cloud-sync-url', this.syncUrl)
    }
    localStorage.setItem('pomo-cloud-last-sync', this.lastSyncTime.toString())
  }

  async syncNow(): Promise<boolean> {
    if (!this.isOnline) {
      console.log('📴 Offline - cannot sync to cloud')
      return false
    }

    if (localStorage.getItem('pomo-cloud-sync-disabled') === 'true') {
      return false
    }

    try {
      // Get data through ServiceOrchestrator
      const tasks = this.serviceOrchestrator.getAllTasks()
      const projects = this.serviceOrchestrator.getAllProjects()
      const settings = this.serviceOrchestrator.getConfig()

      const syncData = {
        tasks,
        projects,
        settings,
        timestamp: Date.now(),
        version: '1.0',
        deviceId: this.getDeviceId(),
        deviceName: this.getDeviceName()
      }

      let result
      if (this.syncUrl) {
        result = await this.provider.upload(syncData)
        console.log(`🔄 Updated cloud sync: ${result.url}`)
      } else {
        result = await this.provider.upload(syncData)
        this.syncUrl = result.url
        console.log(`☁️ Created cloud sync: ${result.url}`)
      }

      this.lastSyncTime = Date.now()
      this.saveSyncState()

      return true

    } catch (error) {
      if (error.message.includes('API key required')) {
        if (!this.warnedAboutMissingKey) {
          console.warn('⚠️ Cloud sync disabled: No API key configured')
          console.info('💡 To enable cloud sync, get a free JSONBin API key:')
          console.info('   1. Sign up at https://jsonbin.io/')
          console.info('   2. Get your API key from dashboard')
          console.info('   3. Set it with: localStorage.setItem("jsonbin-api-key", "your-key-here")')
          console.info('   4. Or disable cloud sync with: localStorage.setItem("pomo-cloud-sync-disabled", "true")')
          this.warnedAboutMissingKey = true
        }
      } else {
        console.error('❌ Cloud sync failed:', error)
      }
      return false
    }
  }

  async syncFromCloud(): Promise<boolean> {
    if (!this.isOnline || !this.syncUrl) {
      console.log('📴 Offline or no sync URL - cannot download from cloud')
      return false
    }

    try {
      const cloudData = await this.provider.download(this.extractIdFromUrl(this.syncUrl))
      const localTimestamp = await this.getLocalTimestamp()

      if (cloudData.timestamp > localTimestamp) {
        await this.mergeFromCloud(cloudData)
        console.log('📥 Synced from cloud: newer data found')
        return true
      } else {
        console.log('📊 Local data is up to date')
        return false
      }

    } catch (error) {
      console.error('❌ Failed to sync from cloud:', error)
      return false
    }
  }

  private async getLocalTimestamp(): Promise<number> {
    const tasks = this.serviceOrchestrator.getAllTasks()
    const projects = this.serviceOrchestrator.getAllProjects()

    let latestTimestamp = 0

    if (tasks && tasks.length > 0) {
      const taskTimestamps = tasks.map((t: any) => new Date(t.updatedAt).getTime())
      latestTimestamp = Math.max(latestTimestamp, ...taskTimestamps)
    }

    if (projects && projects.length > 0) {
      const projectTimestamps = projects.map((p: any) => new Date(p.createdAt).getTime())
      latestTimestamp = Math.max(latestTimestamp, ...projectTimestamps)
    }

    return latestTimestamp
  }

  private async mergeFromCloud(cloudData: any): Promise<void> {
    try {
      // Merge tasks through ServiceOrchestrator
      if (cloudData.tasks && Array.isArray(cloudData.tasks)) {
        const localTasks = this.serviceOrchestrator.getAllTasks()
        const mergedTasks = this.mergeArrays(localTasks, cloudData.tasks, 'id')

        // Delete existing tasks that aren't in merged set
        const localTaskIds = new Set(localTasks.map(t => t.id))
        const mergedTaskIds = new Set(mergedTasks.map(t => t.id))
        const tasksToDelete = Array.from(localTaskIds).filter(id => !mergedTaskIds.has(id))

        if (tasksToDelete.length > 0) {
          await this.serviceOrchestrator.deleteMultipleTasks(tasksToDelete)
        }

        // Create/update tasks from cloud
        for (const cloudTask of mergedTasks) {
          const existingTask = localTasks.find(t => t.id === cloudTask.id)
          if (existingTask) {
            await this.serviceOrchestrator.updateTask(cloudTask.id, cloudTask)
          } else {
            await this.serviceOrchestrator.createTask(cloudTask)
          }
        }
      }

      // Merge projects through ServiceOrchestrator
      if (cloudData.projects && Array.isArray(cloudData.projects)) {
        const localProjects = this.serviceOrchestrator.getAllProjects()
        const mergedProjects = this.mergeArrays(localProjects, cloudData.projects, 'id')

        // Similar merge logic for projects
        const localProjectIds = new Set(localProjects.map(p => p.id))
        const mergedProjectIds = new Set(mergedProjects.map(p => p.id))
        const projectsToDelete = Array.from(localProjectIds).filter(id => !mergedProjectIds.has(id))

        if (projectsToDelete.length > 0) {
          for (const projectId of projectsToDelete) {
            await this.serviceOrchestrator.deleteProject(projectId)
          }
        }

        for (const cloudProject of mergedProjects) {
          const existingProject = localProjects.find(p => p.id === cloudProject.id)
          if (existingProject) {
            await this.serviceOrchestrator.updateProject(cloudProject.id, cloudProject)
          } else {
            await this.serviceOrchestrator.createProject(cloudProject)
          }
        }
      }

      localStorage.setItem('pomo-flow-cloud-last-sync', cloudData.timestamp.toString())
      console.log('✅ Cloud data merged successfully')

    } catch (error) {
      console.error('❌ Failed to merge cloud data:', error)
    }
  }

  private mergeArrays(local: any[], cloud: any[], keyField: string): any[] {
    const merged = [...local]
    const localKeys = new Set(local.map(item => item[keyField]))

    for (const cloudItem of cloud) {
      if (!localKeys.has(cloudItem[keyField])) {
        merged.push(cloudItem)
      }
    }

    return merged
  }

  private extractIdFromUrl(url: string): string {
    const match = url.match(/\/([a-f0-9]+)$/)
    return match ? match[1] : url
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('pomo-flow-device-id')
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('pomo-flow-device-id', deviceId)
    }
    return deviceId
  }

  private getDeviceName(): string {
    const platform = navigator.platform
    const userAgent = navigator.userAgent

    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS Device'
    if (userAgent.includes('Android')) return 'Android Device'
    if (platform.includes('Win')) return 'Windows Device'
    if (platform.includes('Mac')) return 'Mac Device'
    if (platform.includes('Linux')) return 'Linux Device'

    return 'Unknown Device'
  }

  async enableSync(provider: 'jsonbin' | 'github'): Promise<void> {
    if (provider === 'github') {
      const token = localStorage.getItem('github-token')
      if (!token) {
        throw new Error('GitHub token required. Set it in browser console: localStorage.setItem("github-token", "your-token")')
      }
      this.provider = GitHubGistProvider
    } else {
      this.provider = JSONBinProvider
    }

    this.saveSyncState()
    console.log(`🔐 Cloud sync enabled with ${this.provider.name}`)
  }

  async setGitHubToken(token: string): Promise<void> {
    localStorage.setItem('github-token', token)
    if (this.provider.name === 'GitHub Gist') {
      this.provider.headers = { ...this.provider.headers, 'Authorization': `token ${token}` }
    }
    console.log('🔑 GitHub token set successfully')
  }

  async disableSync(): Promise<void> {
    this.syncUrl = null
    this.lastSyncTime = 0
    this.saveSyncState()
    localStorage.setItem('pomo-cloud-sync-disabled', 'true')
    console.log('🚫 Cloud sync disabled')
  }

  getSyncStatus() {
    return {
      provider: this.provider.name,
      isOnline: this.isOnline,
      syncUrl: this.syncUrl,
      lastSyncTime: this.lastSyncTime,
      nextSyncIn: this.isOnline ? Math.max(0, this.syncInterval - (Date.now() - this.lastSyncTime)) : -1,
      deviceId: this.getDeviceId(),
      deviceName: this.getDeviceName()
    }
  }

  cleanup() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
  }
}

export function useCloudSyncService() {
  const serviceOrchestrator = useServiceOrchestrator()

  // Check if cloud sync is disabled
  const isCloudSyncDisabled = localStorage.getItem('pomo-cloud-sync-disabled') === 'true'

  if (isCloudSyncDisabled) {
    return {
      syncNow: async () => false,
      syncFromCloud: async () => false,
      enableSync: async (provider: 'jsonbin' | 'github') => {
        localStorage.removeItem('pomo-cloud-sync-disabled')
        console.log('🔐 Cloud sync re-enabled. Please refresh the app.')
      },
      disableSync: () => {
        localStorage.setItem('pomo-cloud-sync-disabled', 'true')
        console.log('🚫 Cloud sync disabled')
      },
      setGitHubToken: (token: string) => localStorage.setItem('github-token', token),
      setJSONBinKey: (key: string) => localStorage.setItem('jsonbin-api-key', key),
      syncStatus: ref({
        provider: 'disabled',
        isOnline: navigator.onLine,
        syncUrl: null,
        lastSyncTime: 0,
        nextSyncIn: -1,
        deviceId: 'disabled',
        deviceName: 'Disabled'
      }),
      cleanup: () => {}
    }
  }

  const syncManager = new CloudSyncServiceManager(serviceOrchestrator)
  const syncStatus = ref(syncManager.getSyncStatus())

  const statusTimer = setInterval(() => {
    syncStatus.value = syncManager.getSyncStatus()
  }, 30000)

  return {
    syncNow: () => syncManager.syncNow(),
    syncFromCloud: () => syncManager.syncFromCloud(),
    enableSync: (provider: 'jsonbin' | 'github') => syncManager.enableSync(provider),
    disableSync: () => syncManager.disableSync(),
    setGitHubToken: (token: string) => syncManager.setGitHubToken(token),
    setJSONBinKey: (key: string) => localStorage.setItem('jsonbin-api-key', key),
    syncStatus,
    cleanup: () => {
      clearInterval(statusTimer)
      syncManager.cleanup()
    },

    // Service access
    serviceOrchestrator
  }
}