# Configuration

Best practices for configuring the conflict resolution system.

## Default Configuration

```typescript
// src/config/conflictResolution.ts
export const defaultConfig = {
  // Detection settings
  detection: {
    enabled: true,
    checksumValidation: true,
    deviceTracking: true
  },

  // Auto-resolution settings
  autoResolution: {
    enabled: true,
    maxSeverity: 'medium',  // Auto-resolve up to this severity
    strategies: {
      mergeCandidates: 'merge',
      timestampConflicts: 'last_write_wins',
      metadataOnly: 'last_write_wins'
    }
  },

  // Severity thresholds
  severity: {
    criticalFields: ['id', 'title', 'status'],
    highFields: ['dueDate', 'priority', 'completed', 'projectId'],
    mediumFields: ['description', 'tags', 'subtasks']
  },

  // UI settings
  ui: {
    showNotifications: true,
    autoOpenDialog: false,
    bulkActionsEnabled: true
  },

  // Performance settings
  performance: {
    batchSize: 10,
    debounceMs: 100,
    cacheSize: 1000
  }
}
```

## Configuration Options

### Detection Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable conflict detection |
| `checksumValidation` | boolean | true | Validate data integrity |
| `deviceTracking` | boolean | true | Track device origins |

```typescript
const detector = new ConflictDetector({
  checksumEnabled: true,
  deviceId: 'device-123'
})
```

### Auto-Resolution Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable auto-resolution |
| `maxSeverity` | string | 'medium' | Max severity to auto-resolve |
| `strategies` | object | {...} | Strategy per conflict type |

```typescript
const resolver = new ConflictResolution({
  defaultStrategy: ResolutionType.LAST_WRITE_WINS,
  autoResolveUpTo: 'medium'
})
```

### Severity Configuration

Customize which fields trigger which severity levels:

```typescript
const detector = new ConflictDetector({
  severityThresholds: {
    criticalFields: ['id', 'title', 'status', 'customCriticalField'],
    highFields: ['dueDate', 'priority', 'assignee'],
    mediumFields: ['description', 'tags']
  }
})
```

### Custom Resolvers

Define field-specific resolution logic:

```typescript
const resolver = new ConflictResolution({
  customResolvers: {
    // Numeric: always take max
    completedPomodoros: (local, remote) =>
      Math.max(local || 0, remote || 0),

    // Array: combine unique values
    tags: (local, remote) =>
      [...new Set([...(local || []), ...(remote || [])])],

    // Status: prefer completed
    status: (local, remote) => {
      if (local === 'done' || remote === 'done') return 'done'
      return local
    }
  }
})
```

---

## Environment-Specific Configuration

### Development

```typescript
// config/development.ts
export const devConfig = {
  detection: {
    enabled: true,
    checksumValidation: false  // Faster in dev
  },
  autoResolution: {
    enabled: false  // Manual review in dev
  },
  ui: {
    autoOpenDialog: true  // See conflicts immediately
  },
  performance: {
    debounceMs: 0  // Immediate processing
  }
}
```

### Production

```typescript
// config/production.ts
export const prodConfig = {
  detection: {
    enabled: true,
    checksumValidation: true
  },
  autoResolution: {
    enabled: true,
    maxSeverity: 'low'  // Conservative in prod
  },
  performance: {
    batchSize: 20,
    debounceMs: 200,
    cacheSize: 5000
  }
}
```

### Testing

```typescript
// config/test.ts
export const testConfig = {
  detection: {
    enabled: true,
    checksumValidation: true
  },
  autoResolution: {
    enabled: false  // Control in tests
  },
  performance: {
    debounceMs: 0,
    cacheSize: 100
  }
}
```

---

## Runtime Configuration

### Loading Configuration

```typescript
// src/config/index.ts
import { defaultConfig } from './conflictResolution'

export function loadConfig() {
  const env = import.meta.env.MODE

  // Load environment-specific overrides
  const envConfig = await import(`./config/${env}.ts`)
    .catch(() => ({}))

  // Merge with defaults
  return deepMerge(defaultConfig, envConfig)
}
```

### Dynamic Configuration

```typescript
// Change config at runtime
const conflictSystem = useConflictSystem()

// Disable auto-resolution temporarily
conflictSystem.configure({
  autoResolution: { enabled: false }
})

// Re-enable
conflictSystem.configure({
  autoResolution: { enabled: true }
})
```

---

## Configuration Validation

### Schema Validation

```typescript
import { z } from 'zod'

const configSchema = z.object({
  detection: z.object({
    enabled: z.boolean(),
    checksumValidation: z.boolean(),
    deviceTracking: z.boolean()
  }),
  autoResolution: z.object({
    enabled: z.boolean(),
    maxSeverity: z.enum(['low', 'medium', 'high', 'critical']),
    strategies: z.record(z.string())
  }),
  severity: z.object({
    criticalFields: z.array(z.string()),
    highFields: z.array(z.string()),
    mediumFields: z.array(z.string())
  }),
  ui: z.object({
    showNotifications: z.boolean(),
    autoOpenDialog: z.boolean(),
    bulkActionsEnabled: z.boolean()
  }),
  performance: z.object({
    batchSize: z.number().min(1).max(100),
    debounceMs: z.number().min(0).max(1000),
    cacheSize: z.number().min(0).max(10000)
  })
})

export function validateConfig(config: unknown) {
  return configSchema.parse(config)
}
```

---

## Configuration Best Practices

### 1. Start Conservative

Begin with conservative settings and adjust based on user feedback:

```typescript
// Start with low auto-resolve
autoResolution: {
  maxSeverity: 'low'
}

// Increase after validation
autoResolution: {
  maxSeverity: 'medium'
}
```

### 2. Log Configuration Changes

```typescript
function configure(newConfig: Partial<ConflictConfig>) {
  console.log('Conflict config updated:', {
    previous: this.config,
    new: newConfig,
    merged: deepMerge(this.config, newConfig)
  })

  this.config = deepMerge(this.config, newConfig)
}
```

### 3. Validate Before Apply

```typescript
function configure(newConfig: Partial<ConflictConfig>) {
  // Validate
  const validated = validateConfig(deepMerge(this.config, newConfig))

  // Apply
  this.config = validated
}
```

### 4. Provide Sensible Defaults

```typescript
function getConfig(options?: Partial<ConflictConfig>): ConflictConfig {
  return {
    ...defaultConfig,
    ...options,
    // Ensure required fields
    detection: {
      ...defaultConfig.detection,
      ...options?.detection
    }
  }
}
```

---

## See Also

- [Deployment](./deployment.md) - Deployment considerations
- [Maintenance](./maintenance.md) - Ongoing maintenance
- [Architecture Overview](../02-developer-guide/architecture-overview.md) - System design
