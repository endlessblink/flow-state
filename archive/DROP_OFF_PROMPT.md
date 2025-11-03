# POMO-FLOW PROJECT DROP OFF PROMPT
**Use this prompt when starting a new session or handing off to Claude**

---

## 🎯 CURRENT CONTEXT

**Main Working Directory:** `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/`

**✅ WORKING VERSION:** `pomo-flow-board/` - This is the functional pomo-flow application

**🔧 STATUS:** You're manually reorganizing directories - all pomo-flow servers killed, backup created, ready for cleanup

**What Works in pomo-flow-board:**
- ✅ Kanban board with drag-and-drop functionality
- ✅ Task creation, editing, deletion
- ✅ Task counter matches display (sync works)
- ✅ Basic filtering and status management
- ✅ Local state management (Pinia store)
- ✅ Vue 3 + TypeScript + Vite setup

**Current Port:** 5546 (configured in vite.config.ts)

---

## 🚀 QUICK START COMMANDS

```bash
# Navigate to working project
cd pomo-flow-board

# Start development server
npm run dev

# Install dependencies (if needed)
npm install

# Run tests
npm run test

# Build for production
npm run build
```

---

## 📁 PROJECT STRUCTURE

```
Productivity/
├── pomo-flow-board/              # ✅ WORKING VERSION (use this)
│   ├── src/
│   │   ├── stores/tasks.ts       # Main task management store
│   │   ├── views/BoardView.vue   # Kanban board component
│   │   └── ...other files
│   ├── package.json              # Dependencies
│   ├── vite.config.ts           # Vite configuration
│   ├── broken-version-reference/ # ❌ Broken version for reference only
│   └── DROP_OFF_PROMPT.md       # This file
├── pomo-flow-copy/               # ❌ Broken variant copy (ignore)
└── [other cleanup needed...]     # You're manually reorganizing
```

---

## 💾 BACKUP INFORMATION

**Complete Backup Location:** `~/pomo-all-variants-backup-20251102-092918.tar.gz`

**What's in backup:**
- All pomo-flow variants (working + broken)
- tasks/ directory
- .claude/ directory
- memories/ directory
- Reference documentation

**To restore if needed:**
```bash
cd ~/backups/  # or wherever backup is located
tar -xzf pomo-all-variants-backup-20251102-092918.tar.gz
```

---

## 🛠️ TECHNOLOGY STACK

- **Frontend:** Vue 3 + TypeScript
- **Build Tool:** Vite
- **State Management:** Pinia
- **Drag & Drop:** vuedraggable (working version)
- **Styling:** Tailwind CSS
- **Testing:** Vitest + Playwright

---

## 📋 WHAT TO WORK ON

**✅ DO:**
- Work in `pomo-flow-board/` directory only
- Test functionality before making changes
- Add features incrementally
- Use backup variants for reference only

**❌ DON'T:**
- Don't use other pomo-flow-* variants (they're broken)
- Don't try to fix broken versions (use working version)
- Don't merge complexity from broken variants

---

## 🔍 CURRENT TASKS

**If you need to work on something specific:**

1. **Navigate to working version:** `cd pomo-flow-board`
2. **Start dev server** to see current functionality
3. **Run tests** to verify everything works
4. **Check package.json** for current dependencies
5. **Review BoardView.vue** for kanban implementation

---

## 📊 DEVELOPMENT STATUS

**Last Updated:** 2025-11-02
**Version:** Working baseline (pomo-flow-board)
**Status:** ✅ All servers killed, backup created, ready for manual reorganization

**Key Files to Understand:**
- `pomo-flow-board/src/stores/tasks.ts` - Main store logic
- `pomo-flow-board/src/views/BoardView.vue` - Kanban board
- `pomo-flow-board/package.json` - Dependencies
- `pomo-flow-board/vite.config.ts` - Configuration

---

## 🎨 DESIGN PHILOSOPHY

**Keep it simple and working:**
- pomo-flow-board has proven functionality
- Don't over-engineer without need
- Add features incrementally when required
- Always test after changes
- Use backup variants for reference, but don't merge complexity

---

## 🚨 IMPORTANT NOTES

- ✅ **Only work in pomo-flow-board** - it's the only functional version
- ✅ **Backup is safe** - can restore any variant if needed
- ✅ **Test thoroughly** after any changes
- ✅ **Keep it simple** - add complexity only when needed

---

## 🎯 WHEN STARTING WORK

1. **Navigate to working directory:** `cd pomo-flow-board`
2. **Start dev server:** `npm run dev`
3. **Verify functionality** in browser
4. **Make incremental changes**
5. **Test and commit** your work

**You're ready to develop!** 🚀

---

## 💡 TROUBLESHOOTING

**If something doesn't work:**
1. Make sure you're in `pomo-flow-board` directory
2. Run `npm install` to ensure dependencies
3. Check console for errors
4. Restore from backup if needed

**If you need a feature from broken variants:**
1. Extract from backup: `tar -xzf ~/pomo-all-variants-backup-20251102-092918.tar.gz pomo-flow-calendar/src/components/CalendarView.vue`
2. Copy specific files to pomo-flow-board
3. Test integration carefully
4. Don't copy entire broken projects