# Port Manager

**⚙️ ACTIVATING PORT MANAGER SKILL**

Manages port configuration and server operations for the productivity application, ensuring consistent use of port 5546 across all development and testing scenarios.

## When to Use
- Starting the development server
- Running Playwright MCP tests
- Accessing the application in browser
- Configuring local development environment
- Setting up testing environments
- Any server-related operations

## Primary Port Configuration

### Default Port: 5546
```
Development Server: http://localhost:5546
Playwright Testing: http://localhost:5546
Storybook Access: http://localhost:5546/#/design-system
```

## Port Management Patterns

### Development Server Commands
```bash
# Always use port 5546 for development
npm run dev          # Uses --host 0.0.0.0 --port 5546
npm run storybook    # Uses --port 6006 (separate from main app)
```

### Server Configuration Files
```json
// package.json scripts
{
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5546",
    "storybook": "storybook dev -p 6006"
  }
}
```

### Playwright Test Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5546',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  },
  use: {
    baseURL: 'http://localhost:5546'
  }
})
```

## Server Health Checks

### Verify Server is Running on Port 5546
```typescript
const checkServerHealth = async () => {
  try {
    const response = await fetch('http://localhost:5546')
    return response.ok
  } catch (error) {
    console.error('Server not accessible on port 5546:', error)
    return false
  }
}
```

### Port Conflict Resolution
```bash
# Kill any processes using port 5546
lsof -ti:5546 | xargs kill -9

# Or use pkill for node processes
pkill -f "vite.*5546"
```

## Development Workflow Commands

### Start Development Server
```bash
# Always use this command to start the app
npm run dev
# Server runs on: http://localhost:5546
```

### Verify Application Access
```bash
# Check if app is accessible
curl http://localhost:5546

# Or open in browser
open http://localhost:5546
```

### Start Testing Environment
```bash
# Ensure server is running before tests
npm run dev &
sleep 5  # Wait for server to start
npm run test
```

## Port Usage Guidelines

### Fixed Ports for This Application
- **5546**: Main development server (NEVER change)
- **6006**: Storybook documentation (fixed)

### Port Configuration Rules
1. **Always use port 5546** for main application
2. **Never hardcode other ports** in documentation or scripts
3. **Check port availability** before starting server
4. **Handle port conflicts** gracefully
5. **Use consistent URLs** across all tools and documentation

## Server Status Monitoring

### Server Status Indicators
```typescript
// Server status check
const serverStatus = {
  port: 5546,
  url: 'http://localhost:5546',
  status: 'running', // 'running' | 'stopped' | 'error'
  lastCheck: new Date()
}
```

### Common Server Issues and Solutions

#### Port Already in Use
```bash
# Find process using port 5546
lsof -i :5546

# Kill the process
kill -9 <PID>

# Restart server
npm run dev
```

#### Server Not Responding
```bash
# Check if server process is running
ps aux | grep vite

# Restart server if needed
pkill -f vite
npm run dev
```

## Browser Access Patterns

### Development URLs
```
Main Application: http://localhost:5546
Storybook: http://localhost:6006
Design System: http://localhost:5546/#/design-system
```

### Testing URLs
```
Playwright Tests: http://localhost:5546 (automated)
Manual Testing: http://localhost:5546
Visual Regression: http://localhost:5546
```

## Environment Variables

### Port Configuration
```bash
# .env.local
VITE_DEV_PORT=5546
VITE_APP_URL=http://localhost:5546
```

### Usage in Code
```typescript
// Get port from environment
const PORT = import.meta.env.VITE_DEV_PORT || 5546
const APP_URL = import.meta.env.VITE_APP_URL || `http://localhost:${PORT}`
```

## Skill Activation Message
When this skill is used, Claude Code will start with:
```
⚙️ **PORT MANAGER SKILL ACTIVATED**
Configuring server operations for port 5546 - ensuring consistent development environment...
```

## Port Verification Checklist

Before starting any development or testing:
- [ ] Port 5546 is available
- [ ] Development server starts on correct port
- [ ] Application accessible at http://localhost:5546
- [ ] No port conflicts with other services
- [ ] Browser can access the application
- [ ] Playwright tests can connect to the server

This skill ensures that all server operations consistently use port 5546, preventing port conflicts and ensuring reliable development and testing environments.