#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, relative } from 'path';
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, chmodSync, statSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Portable Claude Code Skill Monitoring System');
console.log('==============================================');
console.log('');

// Get the path to this script's directory (source project)
const sourceProjectDir = __dirname;
const targetProjectDir = process.cwd();

console.log(`📍 Source project: ${sourceProjectDir}`);
console.log(`📍 Target project: ${targetProjectDir}`);
console.log('');

// Check if target project has .claude directory
const targetClaudeDir = join(targetProjectDir, '.claude');
if (!existsSync(targetClaudeDir)) {
  console.log('❌ Target project does not have a .claude directory');
  console.log('💡 Make sure you run this from a Claude Code project folder');
  process.exit(1);
}

// Function to copy files with proper permissions
function copyFile(src, dest) {
  // Ensure destination directory exists
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Copy file
  copyFileSync(src, dest);
  chmodSync(dest, 0o755); // Make executable
  console.log(`   ✅ Copied: ${relative(targetProjectDir, dest)}`);
}

// Function to copy directory recursively
function copyDirectory(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const files = readdirSync(src);
  for (const file of files) {
    const srcPath = join(src, file);
    const destPath = join(dest, file);

    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

console.log('📋 Installing skill monitoring system in target project...');
console.log('');

try {
  // Copy hook script
  const hookScript = join(sourceProjectDir, '.claude', 'hooks', 'skill-logger.sh');
  const targetHookScript = join(targetProjectDir, '.claude', 'hooks', 'skill-logger.sh');
  if (existsSync(hookScript)) {
    copyFile(hookScript, targetHookScript);
  } else {
    console.log('   ⚠️  Hook script not found in source project');
  }

  // Copy MCP server
  const mcpServerDir = join(sourceProjectDir, '.claude', 'mcp-logging-server');
  const targetMcpServerDir = join(targetProjectDir, '.claude', 'mcp-logging-server');
  if (existsSync(mcpServerDir)) {
    copyDirectory(mcpServerDir, targetMcpServerDir);
  } else {
    console.log('   ⚠️  MCP server not found in source project');
  }

  // Copy dashboard files
  const dashboardFile = join(sourceProjectDir, 'mcp-dashboard.html');
  const targetDashboardFile = join(targetProjectDir, 'mcp-dashboard.html');
  if (existsSync(dashboardFile)) {
    copyFile(dashboardFile, targetDashboardFile);
  } else {
    console.log('   ⚠️  Dashboard file not found in source project');
  }

  // Copy server files
  const serverFiles = [
    'start-skill-monitoring-simple.js',
    'start-dashboard-server.js',
    'simple-skill-monitor.js'
  ];

  for (const file of serverFiles) {
    const srcFile = join(sourceProjectDir, file);
    const targetFile = join(targetProjectDir, file);
    if (existsSync(srcFile)) {
      copyFile(srcFile, targetFile);
    } else {
      console.log(`   ⚠️  ${file} not found in source project`);
    }
  }

  // Update package.json if it exists
  const packageJsonPath = join(targetProjectDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    packageJson.scripts['skill-logs:start'] = 'node start-skill-monitoring-simple.js';
    packageJson.scripts['skill-logs:server'] = 'node .claude/mcp-logging-server/server.js';
    packageJson.scripts['skill-logs:dashboard'] = 'node start-dashboard-server.js';
    packageJson.scripts['skill-logs:monitor'] = 'node simple-skill-monitor.js';

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('   ✅ Updated package.json with skill logging scripts');
  }

  // Create or update .claude/settings.local.json with proper hook configuration
  const settingsPath = join(targetProjectDir, '.claude', 'settings.local.json');

  // Check if settings.local.json already exists
  let existingConfig = {};
  if (existsSync(settingsPath)) {
    try {
      const existingContent = readFileSync(settingsPath, 'utf8');
      existingConfig = JSON.parse(existingContent);
    } catch (error) {
      console.log('   ⚠️  Could not parse existing settings.local.json, creating new one');
    }
  }

  // Merge or create hook configuration with relative paths
  const hookConfig = {
    ...existingConfig,
    "permissions": {
      ...(existingConfig.permissions || {}),
      "allow": [
        ...(existingConfig.permissions?.allow || []),
        "Bash(.claude/hooks/skill-logger.sh:*)",
        "Bash(bash .claude/hooks/skill-logger.sh:*)"
      ].filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates
      "deny": existingConfig.permissions?.deny || [],
      "ask": existingConfig.permissions?.ask || []
    },
    "hooks": {
      ...(existingConfig.hooks || {}),
      "PreToolUse": [
        ...(existingConfig.hooks?.PreToolUse?.filter(hook => hook.matcher !== "Skill") || []),
        {
          "matcher": "Skill",
          "hooks": [
            {
              "type": "command",
              "command": "bash .claude/hooks/skill-logger.sh pre \"$CLAUDE_TOOL_NAME\" \"$CLAUDE_TOOL_INPUT\""
            }
          ]
        }
      ],
      "PostToolUse": [
        ...(existingConfig.hooks?.PostToolUse?.filter(hook => hook.matcher !== "Skill") || []),
        {
          "matcher": "Skill",
          "hooks": [
            {
              "type": "command",
              "command": "bash .claude/hooks/skill-logger.sh post \"$CLAUDE_TOOL_NAME\" \"$CLAUDE_TOOL_OUTPUT\""
            }
          ]
        }
      ]
    }
  };

  // Write the merged hook configuration
  writeFileSync(settingsPath, JSON.stringify(hookConfig, null, 2));
  console.log('   ✅ Created/updated .claude/settings.local.json with portable hook configuration');
  console.log(`   📝 Hook commands use relative paths for target project: ${targetProjectDir}`);

  // Verify hook configuration after installation
  console.log('');
  console.log('🔍 Verifying installation...');

  const verifyHookConfig = () => {
    const verifyPath = join(targetProjectDir, '.claude', 'settings.local.json');
    if (existsSync(verifyPath)) {
      try {
        const verifyContent = readFileSync(verifyPath, 'utf8');
        const verifyConfig = JSON.parse(verifyContent);

        const preToolHook = verifyConfig.hooks?.PreToolUse?.find(hook => hook.matcher === "Skill");
        const postToolHook = verifyConfig.hooks?.PostToolUse?.find(hook => hook.matcher === "Skill");

        if (preToolHook && postToolHook) {
          console.log('   ✅ Hook configuration verified');
          console.log('   ✅ PreToolUse and PostToolUse hooks configured for Skill matcher');

          // Check if hook paths are relative (not absolute)
          const preCommand = preToolHook.hooks[0].command;
          const postCommand = postToolHook.hooks[0].command;

          if (preCommand.includes('bash .claude/hooks/') && postCommand.includes('bash .claude/hooks/')) {
            console.log('   ✅ Hook commands use relative paths (portable)');
          } else {
            console.log('   ⚠️  Hook commands may use absolute paths (non-portable)');
          }
        } else {
          console.log('   ❌ Hook configuration incomplete');
        }
      } catch (error) {
        console.log('   ❌ Could not verify hook configuration');
      }
    } else {
      console.log('   ❌ Settings file not found');
    }
  };

  verifyHookConfig();

  console.log('');
  console.log('✅ Skill monitoring system installed successfully!');
  console.log('');
  console.log('📋 Available commands in target project:');
  console.log('   npm run skill-logs:start      # Start complete monitoring system');
  console.log('   npm run skill-logs:server    # Start MCP server only');
  console.log('   npm run skill-logs:dashboard # Start dashboard server only');
  console.log('   npm run skill-logs:monitor   # Start terminal monitor only');
  console.log('');
  console.log('🌐 To start the complete system:');
  console.log(`   cd "${targetProjectDir}"`);
  console.log('   npm run skill-logs:start');
  console.log('');
  console.log('📋 Hook Configuration: ✅ Auto-configured in .claude/settings.local.json');
  console.log('   Skills will be logged automatically when used');
  console.log('');
  console.log('🧪 TESTING INSTRUCTIONS:');
  console.log('   1. Start monitoring: npm run skill-logs:start');
  console.log('   2. Use any Claude Code skill to see automatic logging');
  console.log('   3. Check terminal output for skill usage events');
  console.log('   4. Open dashboard: http://localhost:8080 for visual monitoring');

} catch (error) {
  console.error('❌ Error installing skill monitoring system:', error.message);
  process.exit(1);
}