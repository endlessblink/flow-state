# Firebase MCP Server Setup Guide

## 🎯 Overview
The Firebase MCP server is built into `firebase-tools` and allows Claude to manage Firebase directly from the conversation.

---

## Step 1: Install Firebase CLI

Run this command in your terminal:

```bash
npm install -g firebase-tools@latest
```

Verify installation:

```bash
firebase --version
# Should show: 13.x.x or higher
```

---

## Step 2: Login to Firebase

Authenticate with your Google account:

```bash
firebase login
```

**What happens:**
1. Browser opens for Google login
2. Select your Google account
3. Grant Firebase CLI permissions
4. Terminal shows: ✔ Success! Logged in as your-email@gmail.com

**Verify login:**

```bash
firebase projects:list
# Should show your existing Firebase projects (if any)
```

---

## Step 3: Add Firebase MCP to Claude Code (OPTION A - Recommended)

Add the Firebase MCP server to this Claude Code session:

```bash
claude mcp add firebase npx -- -y firebase-tools@latest mcp --dir "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow"
```

**What this does:**
- Adds Firebase MCP server named "firebase"
- Uses `npx` to run `firebase-tools@latest mcp`
- Points to this project directory
- Claude can now manage Firebase in this conversation

---

## Step 3: Alternative - Manual Configuration (OPTION B)

If the `claude mcp add` command doesn't work, manually configure:

### For WSL/Linux (your system):

Edit: `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["-y", "firebase-tools@latest", "mcp", "--dir", "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow"]
    }
  }
}
```

**Then restart Claude Desktop:**

```bash
# Kill Claude Desktop (on Windows)
taskkill /F /IM claude.exe

# Or use your kill script
./kill-claude-clean.ps1
```

---

## Step 4: Verify MCP Connection

Once configured, I (Claude) will have access to Firebase MCP tools:

**Available commands I can use:**
- `firebase_create_project` - Create new Firebase project
- `firebase_deploy` - Deploy rules, indexes, functions
- `firebase_init` - Initialize Firebase in project
- `firebase_login_status` - Check login status
- `firebase_projects_list` - List your Firebase projects
- And more...

To verify, ask me:
> "List my Firebase projects"

I should be able to respond with your existing projects (or empty list if none).

---

## Step 5: What Happens Next

Once MCP is connected, I can automatically:

1. ✅ **Create Firebase project**:
   - I'll run: `firebase projects:create pomo-flow-[id]`
   - Select project location (us-central1, etc.)
   - Enable Firestore Database
   - Enable Authentication

2. ✅ **Configure project**:
   - Add web app to project
   - Get Firebase config credentials
   - Auto-populate `.env.local`

3. ✅ **Deploy resources**:
   - Deploy `firestore.rules`
   - Deploy `firestore.indexes.json`
   - Configure Authentication providers

4. ✅ **Initialize project**:
   - Create `firebase.json`
   - Link project to Firebase
   - Ready for future deployments

**All of this happens automatically!** No manual Firebase Console clicking.

---

## 🚨 Troubleshooting

### "firebase-tools not found"
- Make sure you installed globally: `npm install -g firebase-tools@latest`
- Restart your terminal
- Check PATH: `which firebase` (should show installation path)

### "Not logged in"
- Run: `firebase login`
- Make sure browser auth completed successfully
- Check: `firebase login:list`

### "Permission denied" errors
- Make sure you're logged into the correct Google account
- Check you have owner/editor access to create projects
- Try: `firebase login --reauth`

### MCP server not showing in Claude
- Restart Claude Desktop completely
- Check `claude_desktop_config.json` syntax (valid JSON)
- Check Claude Desktop logs for errors

---

## 📋 Quick Reference

```bash
# Install
npm install -g firebase-tools@latest

# Login
firebase login

# Add MCP to Claude Code
claude mcp add firebase npx -- -y firebase-tools@latest mcp --dir "<project-path>"

# Verify
firebase projects:list

# Check Firebase CLI version
firebase --version

# Re-authenticate if needed
firebase login --reauth

# Logout
firebase logout
```

---

## 🎉 Ready to Use!

Once you've completed Steps 1-2 and either Step 3 Option A or B:

1. Tell me: "Firebase CLI is installed and logged in"
2. I'll verify the MCP connection
3. I'll create the Firebase project automatically
4. I'll deploy rules and indexes
5. I'll configure authentication
6. We'll be ready to code!

---

**Current Status**: Waiting for you to complete Steps 1-2

Let me know when done!
