/**
 * Environment-specific configurations for sync system
 * TASK-136: CouchDB/PouchDB decommissioned Jan 2026 - app uses Supabase
 */

export interface EnvironmentConfig {
  name: string
  mode: 'development' | 'staging' | 'production'
  database: {
    local: {
      name: string
      adapter: 'idb' | 'websql' | 'memory'
      auto_compaction: boolean
      revs_limit: number
    }
    // TASK-136: CouchDB `remote` config removed - app uses Supabase
  }
  sync: {
    live: boolean
    retry: boolean
    timeout: number
    batch_size: number
    batches_limit: number
    heartbeat: number
    back_off_function: (attempt: number) => number
  }
  optimization: {
    maxBackups: number
    maxBackupAge: number
    compressionThreshold: number
    syncIntervalMs: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
    maxRetries: number
  }
  logging: {
    enabled: boolean
    level: 'debug' | 'info' | 'warn' | 'error'
    maxLogEntries: number
    remoteLogging: boolean
  }
  security: {
    requireHTTPS: boolean
    allowedOrigins: string[]
    corsEnabled: boolean
    validateSSL: boolean
  }
  monitoring: {
    enabled: boolean
    metricsInterval: number
    healthCheckInterval: number
    performanceTracking: boolean
  }
}

// Development configuration
export const developmentConfig: EnvironmentConfig = {
  name: 'Development',
  mode: 'development',
  database: {
    local: {
      name: 'pomo-flow-dev',
      adapter: 'idb',
      auto_compaction: true,
      revs_limit: 50
    }
    // TASK-136: CouchDB remote config removed
  },
  sync: {
    live: true,
    retry: true,
    timeout: 30000,
    batch_size: 25,
    batches_limit: 5,
    heartbeat: 30000,
    back_off_function: (attempt) => 1000 * Math.pow(2, attempt) // Exponential backoff
  },
  optimization: {
    maxBackups: 10,
    maxBackupAge: 2 * 60 * 60 * 1000, // 2 hours
    compressionThreshold: 5120, // 5KB
    syncIntervalMs: {
      excellent: 5000,   // 5 seconds
      good: 10000,       // 10 seconds
      fair: 30000,       // 30 seconds
      poor: 60000        // 1 minute
    },
    maxRetries: 7
  },
  logging: {
    enabled: true,
    level: 'debug',
    maxLogEntries: 1000,
    remoteLogging: false
  },
  security: {
    requireHTTPS: false,
    allowedOrigins: ['http://localhost:3000', 'http://localhost:5546'],
    corsEnabled: true,
    validateSSL: false
  },
  monitoring: {
    enabled: true,
    metricsInterval: 5000,
    healthCheckInterval: 10000,
    performanceTracking: true
  }
}

// Staging configuration
export const stagingConfig: EnvironmentConfig = {
  name: 'Staging',
  mode: 'staging',
  database: {
    local: {
      name: 'pomo-flow-staging',
      adapter: 'idb',
      auto_compaction: true,
      revs_limit: 100
    }
    // TASK-136: CouchDB remote config removed
  },
  sync: {
    live: true,
    retry: true,
    timeout: 45000,
    batch_size: 50,
    batches_limit: 10,
    heartbeat: 30000,
    back_off_function: (attempt) => 2000 * Math.pow(1.5, attempt)
  },
  optimization: {
    maxBackups: 7,
    maxBackupAge: 6 * 60 * 60 * 1000, // 6 hours
    compressionThreshold: 10240, // 10KB
    syncIntervalMs: {
      excellent: 15000,  // 15 seconds
      good: 30000,       // 30 seconds
      fair: 60000,       // 1 minute
      poor: 180000       // 3 minutes
    },
    maxRetries: 5
  },
  logging: {
    enabled: true,
    level: 'info',
    maxLogEntries: 500,
    remoteLogging: true
  },
  security: {
    requireHTTPS: true,
    allowedOrigins: ['https://staging.pomoflow.com'],
    corsEnabled: true,
    validateSSL: true
  },
  monitoring: {
    enabled: true,
    metricsInterval: 15000,
    healthCheckInterval: 30000,
    performanceTracking: true
  }
}

// Production configuration
export const productionConfig: EnvironmentConfig = {
  name: 'Production',
  mode: 'production',
  database: {
    local: {
      name: 'pomo-flow',
      adapter: 'idb',
      auto_compaction: true,
      revs_limit: 200
    }
    // TASK-136: CouchDB remote config removed
  },
  sync: {
    live: true,
    retry: true,
    timeout: 60000,
    batch_size: 100,
    batches_limit: 20,
    heartbeat: 30000,
    back_off_function: (attempt) => 5000 * Math.pow(1.2, attempt) // More conservative backoff
  },
  optimization: {
    maxBackups: 5,
    maxBackupAge: 24 * 60 * 60 * 1000, // 24 hours
    compressionThreshold: 20480, // 20KB
    syncIntervalMs: {
      excellent: 30000,  // 30 seconds
      good: 60000,       // 1 minute
      fair: 180000,      // 3 minutes
      poor: 300000       // 5 minutes
    },
    maxRetries: 3
  },
  logging: {
    enabled: true,
    level: 'warn',
    maxLogEntries: 200,
    remoteLogging: true
  },
  security: {
    requireHTTPS: true,
    allowedOrigins: ['https://app.pomoflow.com'],
    corsEnabled: true,
    validateSSL: true
  },
  monitoring: {
    enabled: true,
    metricsInterval: 30000,
    healthCheckInterval: 60000,
    performanceTracking: true
  }
}

// Environment detection and configuration selection
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const mode = import.meta.env.MODE || 'development'

  switch (mode) {
    case 'staging':
      return stagingConfig
    case 'production':
      return productionConfig
    case 'development':
    default:
      return developmentConfig
  }
}

// Current configuration
export const currentConfig = getEnvironmentConfig()

// Utility function to check if we're in production
export const isProduction = (): boolean => currentConfig.mode === 'production'

// Utility function to check if we're in development
export const isDevelopment = (): boolean => currentConfig.mode === 'development'

// Utility function to get environment-specific database name
export const getDatabaseName = (): string => {
  const baseName = currentConfig.database.local.name
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'
  return `${baseName}-v${version.replace(/\./g, '-')}`
}

// Environment-specific CORS settings
export const getCORSConfig = () => {
  const config = currentConfig.security
  return {
    enabled: config.corsEnabled,
    origins: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With']
  }
}

// Environment-specific timeout configurations
// TASK-136: Removed database.remote?.timeout - CouchDB decommissioned
export const getTimeouts = () => ({
  database: 30000, // Default timeout for Supabase
  sync: currentConfig.sync.timeout,
  healthCheck: currentConfig.monitoring.healthCheckInterval,
  retry: {
    base: 5000,
    max: 300000,
    backoff: currentConfig.sync.back_off_function
  }
})

// Export all configurations for testing
export const configs = {
  development: developmentConfig,
  staging: stagingConfig,
  production: productionConfig,
  current: currentConfig
}

// EnvironmentConfig type already exported above