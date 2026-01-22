# Frontend Layout Fixer - Unified Bug Fixer

Fix ALL frontend issues with ONE skill: state hydration, data persistence, CSS layout, badges, and text overflow.

## Setup

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY="your-key-here"
```

## Quick Usage

```javascript
// For ANY frontend bug, use the same function
const result = await fixFrontend({
  javascript: yourCode,           // For state/persistence bugs
  html: yourHTML,                 // For CSS bugs
  css: yourCSS,                   // For CSS bugs
  issue_description: "Your bug",
  context: { project_type: "vue" }
});

console.log(result.bug_category);     // Which bug type
console.log(result.diagnosis);         // Root causes
console.log(result.fixes);             // Exact code/CSS changes
console.log(result.testing_checklist); // How to verify
```

## Bug Categories

| Category | Symptoms | Input Needed |
|----------|----------|--------------|
| **State Hydration** | Phantom duplicates, stale data | `javascript` |
| **Data Persistence** | Data vanishes after refresh | `javascript` |
| **CSS Layout** | Shadow clipping, content cutoff | `html` + `css` |
| **Badge Styling** | Misaligned badges/labels | `html` + `css` |
| **Text Overflow** | Unwanted truncation | `html` + `css` |

## Bug-to-Usage Mapping

### State Hydration Bug (Phantom Tasks)

```javascript
const result = await fixFrontend({
  javascript: `
    const [tasks, setTasks] = useState(
      JSON.parse(localStorage.getItem('tasks') || '[]')  // Problem
    );
  `,
  issue_description: "Phantom duplicate tasks appearing",
  context: { project_type: "react" }
});
```

### Data Persistence Bug (Vanishing Tasks)

```javascript
const result = await fixFrontend({
  javascript: `
    useEffect(() => {
      fetch('/api/tasks')
        .then(r => r.json())
        .then(data => setTasks(data));  // Missing: localStorage.setItem()
    }, []);
  `,
  issue_description: "Tasks vanish after refresh",
  context: { storage_type: "localStorage" }
});
```

### CSS Layout Bug (Shadow Clipping)

```javascript
const result = await fixFrontend({
  html: `<div class="card"><h3>Title</h3></div>`,
  css: `.card { overflow: hidden; box-shadow: 0 -4px 8px rgba(0,0,0,0.15); }`,
  issue_description: "Box shadow clipped at top",
  context: { target_selectors: [".card"] }
});
```

### Badge Styling Bug (Misalignment)

```javascript
const result = await fixFrontend({
  html: `<span class="priority-badge">H</span>`,
  css: `.priority-badge { width: 20px; height: 20px; font-size: 10px; }`,
  issue_description: "Badge text not centered",
  context: {
    target_selectors: [".priority-badge"],
    layout_direction: "rtl"
  }
});
```

### Text Overflow Bug (Truncation)

```javascript
const result = await fixFrontend({
  html: `<span class="task-title">Long task title</span>`,
  css: `.task-title { flex: 1; white-space: nowrap; overflow: hidden; }`,
  issue_description: "Task title truncated",
  context: { target_selectors: [".task-title"] }
});
```

## Output Schema

```javascript
{
  skill_type: "frontend",
  bug_category: "state|persistence|css_layout|badge|text_overflow",

  diagnosis: {
    severity: "critical|high|medium|low",
    root_causes: ["cause 1", "cause 2"],
    category_details: { /* type-specific */ }
  },

  explanation: "Detailed explanation",

  fixes: {
    javascript_patches: [...],  // For state/persistence bugs
    css_patches: [...]          // For CSS bugs
  },

  testing_checklist: [
    "Step 1 to verify",
    "Step 2 to test",
    "Step 3 to confirm"
  ],

  prevention: "How to prevent in future"
}
```

## Quick Reference

### State Hydration Fixes
```javascript
useState([])              // Not useState(localStorage.getItem(...))
key={item.id}             // Not key={index}
return () => abort();     // Cleanup useEffect
```

### Data Persistence Fixes
```javascript
localStorage.setItem('key', JSON.stringify(data));  // Save after fetch
localStorage.removeItem('key');                      // Invalidate on update
```

### CSS Layout Fixes
```css
overflow: visible;   /* Not hidden (shadow clipping) */
min-height: 60px;    /* Not height (content cutoff) */
padding: 12px;       /* Not 0 */
line-height: 1.5;    /* Not 1.2 */
```

### Badge Styling Fixes
```css
display: inline-flex;
align-items: center;
justify-content: center;
inset-inline-end: 0;       /* RTL-safe, not right */
margin-inline-start: 8px;  /* RTL-safe, not margin-left */
```

### Text Overflow Fixes
```css
white-space: normal;   /* Not nowrap */
word-break: break-word;
min-width: 0;          /* Required for flex items */
```

## Best Practices

1. **Provide context** - `project_type`, `storage_type`, `layout_direction`
2. **Add selector hints** - 3-5 likely CSS selectors
3. **Specify constraints** - What NOT to change
4. **Follow testing checklist** - Verify fixes work

## Files

- `SKILL.md` - Complete documentation with 80+ patterns
- `README.md` - This quick start guide
- `examples/` - Example inputs and outputs
