# MCP Configuration - Final Setup

## ✅ Current Active Configuration

**File**: `.mcp.json` (project root)  
**Status**: This is the ONLY file Claude Code needs

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
        "GITHUB_TOKEN": "ghp_your_actual_token_here"
      }
    }
  }
}
```

## 🧹 Cleaned Up Files

I've moved the duplicate configuration files to backups:
- `.claude/mcp.json.backup`
- `.claude-code/.mcp.json.backup` 
- `mcp.json.backup`

## 🔑 Next Steps

1. **Replace the GitHub token** in `.mcp.json`:
   - Change `"ghp_your_actual_token_here"` to your real GitHub Personal Access Token
   - Get token from: GitHub → Settings → Developer settings → Personal access tokens

2. **Required token scopes**:
   - ✅ `repo` (Full repository access)
   - ✅ `read:org` (Read organization data)  
   - ✅ `read:user` (Read user profile)

3. **Restart Claude Code** after updating the token

## 📁 Final Project Structure

```
pomo-flow/
├── .mcp.json                    ← ACTIVE CONFIG FILE
├── .claude/
│   └── mcp.json.backup         ← Backup
├── external-mcp-servers/
│   └── octocode-mcp/           ← Built MCP server
├── node_modules/
│   └── devtools-debugger-mcp/  ← Built MCP server
└── docs/
```

## ✨ You're All Set!

Once you add your GitHub token to `.mcp.json`, both MCP servers will be fully functional:

- **devtools-debugger**: Node.js debugging with breakpoints
- **octocode**: GitHub repository analysis and code search
