# MCP Servers Troubleshooting Guide

## Current Status
✅ Both MCP servers are built and working  
❌ They are not appearing in Claude Code's MCP list

## MCP Server Files Verified
✅ `devtools-debugger-mcp`: `./node_modules/devtools-debugger-mcp/dist/src/index.js`  
✅ `octocode-mcp`: `./external-mcp-servers/octocode-mcp/packages/octocode-mcp/dist/index.js`

Both servers respond correctly to MCP initialization requests.

## Configuration Files Created

I've created MCP configuration files in multiple locations to cover all possibilities:

### 1. Project-level configurations:
- `.mcp.json` (project root)
- `.claude/mcp.json` 
- `.claude-code/mcp.json`
- `mcp.json` (project root)
- `.claude/servers.json`

### 2. Global configuration:
- `%APPDATA%\Claude\claude_desktop_config.json`

## Troubleshooting Steps

### Step 1: Restart Claude Code
Close Claude Code completely and restart it to force reload of configuration files.

### Step 2: Verify Configuration File Format
The current configuration uses this format:

```json
{
  "mcpServers": {
    "devtools-debugger": {
      "type": "stdio",
      "command": "node",
      "args": ["./node_modules/devtools-debugger-mcp/dist/src/index.js"]
    },
    "octocode": {
      "type": "stdio",
      "command": "node", 
      "args": ["./external-mcp-servers/octocode-mcp/packages/octocode-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

### Step 3: Check Claude Code Version
Make sure you're using a version of Claude Code that supports project-level MCP servers. Some older versions may not support `.mcp.json` files.

### Step 4: Manual Verification
Test that the servers work independently:

```bash
# Test devtools-debugger-mcp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node ./node_modules/devtools-debugger-mcp/dist/src/index.js

# Test octocode-mcp  
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node ./external-mcp-servers/octocode-mcp/packages/octocode-mcp/dist/index.js
```

Both should return valid JSON responses (already verified ✅).

### Step 5: Alternative Claude Code CLI Setup
If you have Claude Code CLI installed, try:

```bash
# Navigate to project directory
cd "D:\MY PROJECTS\AI\LLM\AI Code Gen\my-builds\Productivity\pomo-flow"

# Try adding servers using CLI (if available)
claude-code mcp add devtools-debugger --scope project node ./node_modules/devtools-debugger-mcp/dist/src/index.js
claude-code mcp add octocode --scope project node ./external-mcp-servers/octocode-mcp/packages/octocode-mcp/dist/index.js
```

### Step 6: Check Claude Code Logs
Look for any error messages in Claude Code's logs that might indicate why the servers aren't being loaded.

## Next Steps

1. **Restart Claude Code** - This is the most important step
2. **Add GitHub Token** - Replace "your-github-token-here" with your actual GitHub personal access token
3. **Check for Updates** - Make sure you have the latest version of Claude Code
4. **Try Manual Registration** - If available, use Claude Code's built-in MCP server management

## Files Summary

Your project now has MCP servers properly built and configured in multiple locations:

```
pomo-flow/
├── .mcp.json                    # Project MCP config (main)
├── .claude/
│   ├── mcp.json                # Alternative config location
│   └── servers.json           # Alternative format
├── .claude-code/
│   └── mcp.json               # Alternative config location  
├── external-mcp-servers/
│   └── octocode-mcp/          # Built octocode MCP server ✅
├── node_modules/
│   └── devtools-debugger-mcp/ # Built devtools MCP server ✅
└── docs/
    ├── mcp-setup.md
    └── troubleshooting.md     # This file
```

The MCP servers are confirmed working - the issue is likely with Claude Code's configuration file discovery or a restart being needed.
