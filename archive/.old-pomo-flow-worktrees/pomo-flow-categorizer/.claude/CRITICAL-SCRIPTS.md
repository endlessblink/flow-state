# CRITICAL NPM SCRIPTS - DO NOT REMOVE

This file documents critical npm scripts in `package.json` that **MUST NEVER BE REMOVED**.

## Protected Scripts

### `npm run kill` (Line 9 of package.json)

**Script:** `"kill": "bash kill-pomo.sh"`

**Purpose:** Kills all PomoFlow processes running on ports 5546, 5547, and 6006.

**Why Critical:**
- Development server sometimes hangs and needs to be forcefully terminated
- Multiple Vite/Node processes can accumulate during development
- Port conflicts prevent the app from starting
- User frequently needs to clean up stuck processes

**Related Files:**
- `kill-pomo.sh` - Main kill script for standard cleanup
- `kill-pomo-instances.sh` - Alternative comprehensive cleanup script

**Usage:**
```bash
npm run kill
```

**Warning:**
If you remove this script, the user will lose the ability to easily clean up stuck development processes, requiring manual `lsof` and `kill` commands.

---

## How to Add New Protected Scripts

If you need to protect additional scripts from accidental removal:

1. Add the script to package.json
2. Document it in this file with:
   - Script name and line number
   - Exact command
   - Purpose and why it's critical
   - Related files
   - Usage example
3. Add a reference in CLAUDE.md under "Key Development Rules > MUST Follow"

---

**Last Updated:** October 26, 2025
