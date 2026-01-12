---
name: frontend-layout-fixer
description: This skill should be used when identifying and fixing frontend layout issues (clipping, spacing, overflow, RTL text problems) by analyzing DOM and CSS structure and proposing minimal, scoped CSS patches. Triggers on layout bugs, text clipping, overflow issues, spacing problems, and when vanilla Claude cannot pinpoint which CSS selector to modify from a screenshot alone.
---

# Frontend Layout Fixer

## Overview

A specialized skill for diagnosing and fixing frontend layout issues (clipping, spacing, overflow) by analyzing HTML and CSS structure. When vanilla Claude cannot pinpoint which CSS selector to modify from a screenshot alone, this skill provides structured CSS patch recommendations with clear diagnostics and testing checklists.

## When to Use This Skill

- Text is clipped at top/bottom of containers
- Content overflows its parent element
- Spacing issues (too tight, too loose)
- RTL (Hebrew, Arabic) text display problems
- Fixed-height containers cutting off content
- Flex/grid layout alignment issues
- Responsive layout breakages

## Core Workflow

### Step 1: Gather Input

Collect the following information:

```json
{
  "html": "<!-- The HTML structure with the layout issue -->",
  "css": "/* The relevant CSS rules */",
  "context": {
    "issue_description": "Clear description of the visual bug",
    "target_selector_hints": [".card", ".card-title", ".card-meta"],
    "constraints": ["Do not change colors", "Do not change fonts"],
    "viewport_width": 360,
    "viewport_height": 800
  }
}
```

### Step 2: Analyze and Diagnose

Examine the HTML/CSS to identify:
- Root cause of the layout issue
- Which CSS selectors need modification
- Whether HTML changes are required (rare)

### Step 3: Generate Patches

Output structured patches in this format:

```json
{
  "explanation": "1-3 sentence summary of the fix",
  "diagnosis": {
    "root_cause": "identified CSS issue",
    "affected_selectors": [".card", ".card-title"]
  },
  "css_patches": [
    {
      "selector": ".card",
      "old_block": "/* exact current CSS */",
      "new_block": "/* fixed CSS */",
      "rationale": "why this fixes the issue"
    }
  ],
  "html_patches": [],
  "testing_checklist": [
    "Verify min-height allows expansion",
    "Check content is fully visible"
  ]
}
```

### Step 4: Apply and Validate

1. Apply CSS patches using exact string replacement
2. Validate patches do not violate constraints
3. Follow testing checklist to verify fix

## Common Layout Patterns

### Pattern 1: Clipping from Fixed Height

**Problem:**
```css
.card {
  height: 60px;
  overflow: hidden;
}
```

**Solution:**
```css
.card {
  min-height: 60px;
  overflow: visible;
}
```

### Pattern 2: Insufficient Padding

**Problem:**
```css
.card {
  padding: 2px 8px;
}
```

**Solution:**
```css
.card {
  padding: 8px 12px;
}
```

### Pattern 3: RTL Text Line Height

**Problem:**
```css
.text {
  line-height: 1.0;
}
```

**Solution:**
```css
.text {
  line-height: 1.5;
}
```

### Pattern 4: Vertical Centering with Fixed Height

**Problem:**
```css
.container {
  height: 60px;
  justify-content: center;
  overflow: hidden;
}
```

**Solution:**
```css
.container {
  min-height: 60px;
  justify-content: flex-start;
  overflow: visible;
}
```

## Diagnosis Rules

Follow these rules when analyzing layout issues:

1. **Prefer CSS fixes over HTML changes** - Only modify HTML if absolutely necessary (missing flex containers, accessibility attributes)
2. **Be specific with selectors** - Use exact class names, not vague broad rules
3. **Preserve design intent** - Do not change colors, fonts, typography, or overall visual design
4. **Test against constraints** - Never violate user-specified constraints
5. **Patch separately** - If multiple selectors need changes, create separate patches with clear sequencing
6. **Include rationale** - Explain the CSS logic for each patch
7. **Provide testing checklist** - Help users verify the fix works

## System Prompt

When using this skill with Claude API, use this system prompt:

```
You are an expert front-end layout fixer specializing in CSS and DOM diagnosis.

Your role:
- Analyze provided HTML and CSS to identify layout issues (clipping, overflow, spacing).
- Determine the root cause by examining selectors, computed styles, and constraints.
- Propose MINIMAL, SCOPED CSS changes that solve the issue without side effects.
- Only modify HTML if absolutely necessary (e.g., missing flex containers, aria attributes).
- Preserve colors, fonts, typography, and overall design intent.

Rules:
1. Always provide an "explanation" field summarizing your diagnosis in 1-3 sentences.
2. List the "root_cause" clearly (e.g., "fixed height with padding-box sizing clips content").
3. Include "rationale" for each patch explaining the CSS logic.
4. Prefer CSS fixes over HTML rewrites (e.g., use overflow: visible, min-height, padding adjustments).
5. Test against the provided constraints; never break them.
6. Be specific: include exact selectors, not vague broad rules.
7. If multiple selectors need changes, patch them separately with clear sequencing.
8. Always include a "testing_checklist" to help the user verify the fix.

Output ONLY valid JSON matching the schema exactly. No markdown, no explanation outside JSON.
```

## User Prompt Template

```
Analyze this front-end layout issue and provide CSS/HTML patches.

=== HTML ===
{html}

=== CSS ===
{css}

=== ISSUE DESCRIPTION ===
{issue_description}

=== SELECTOR HINTS ===
These selectors are likely involved (prioritize these):
{target_selector_hints_list}

=== CONSTRAINTS ===
Do NOT violate these:
{constraints_list}

=== VIEWPORT CONTEXT ===
Width: {viewport_width}px
Height: {viewport_height}px

Diagnose the root cause and return patches in the exact JSON schema format.
```

## Best Practices

### 1. Selector Hints Are Critical

Always provide 3-5 likely CSS selectors based on your codebase structure. This prevents Claude from guessing blindly.

**Good:**
```json
"target_selector_hints": [".task-card", ".card-title", ".card-meta", ".card-content"]
```

**Bad:**
```json
"target_selector_hints": ["div"]
```

### 2. Constraints Prevent Regressions

Include what NOT to change to prevent unintended side effects:

```json
"constraints": [
  "Do not change colors",
  "Do not modify responsive breakpoints",
  "Keep existing animations",
  "Preserve RTL text support"
]
```

### 3. Viewport Context Matters

Pass the actual viewport size where the issue occurs. Mobile vs desktop may have different root causes.

```json
"viewport_width": 360,
"viewport_height": 800
```

### 4. Validate Before Applying

Always validate patches before applying:
- Check output structure is valid
- Verify constraints are not violated
- Ensure old_block exists in current CSS

## Resources

### scripts/

- `skill.js` - Core skill implementation that calls Claude API
- `patch-applier.js` - Functions to apply CSS/HTML patches
- `validator.js` - Input/output validation and constraint checking

### references/

- `schema.json` - JSON schema for input/output contracts
- `system-prompt.txt` - System prompt for Claude API calls
- `user-prompt-template.txt` - User prompt template

### assets/

- `README.md` - Quick start guide
- `quick-reference.js` - Copy-paste templates and examples
- `examples/` - Example inputs and outputs

## Example Usage

### Input

```javascript
const input = {
  html: `
    <div class="task-card">
      <h4 class="task-title">Hebrew text here</h4>
      <p class="task-meta">Jan 11 - High Priority</p>
    </div>
  `,
  css: `
    .task-card {
      height: 60px;
      padding: 4px 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .task-title {
      font-size: 14px;
      line-height: 1.2;
    }
  `,
  context: {
    issue_description: "Text is clipped at top and bottom. Hebrew text not fully visible.",
    target_selector_hints: [".task-card", ".task-title", ".task-meta"],
    constraints: ["Do not change colors", "Do not change fonts"],
    viewport_width: 360,
    viewport_height: 800
  }
};
```

### Output

```json
{
  "explanation": "The .task-card has fixed height 60px with overflow: hidden, clipping multi-line content. Changing to min-height and removing overflow allows expansion.",
  "diagnosis": {
    "root_cause": "Fixed height with overflow: hidden prevents content from displaying fully",
    "affected_selectors": [".task-card", ".task-title"]
  },
  "css_patches": [
    {
      "selector": ".task-card",
      "old_block": "    .task-card {\n      height: 60px;\n      padding: 4px 12px;\n      overflow: hidden;\n      display: flex;\n      flex-direction: column;\n    }",
      "new_block": "    .task-card {\n      min-height: 60px;\n      padding: 10px 12px;\n      overflow: visible;\n      display: flex;\n      flex-direction: column;\n    }",
      "rationale": "Changed height to min-height for flexibility; increased vertical padding; removed overflow: hidden to prevent clipping"
    },
    {
      "selector": ".task-title",
      "old_block": "    .task-title {\n      font-size: 14px;\n      line-height: 1.2;\n    }",
      "new_block": "    .task-title {\n      font-size: 14px;\n      line-height: 1.5;\n    }",
      "rationale": "Increased line-height from 1.2 to 1.5 for better vertical spacing with Hebrew text"
    }
  ],
  "html_patches": [],
  "testing_checklist": [
    "Inspect .task-card and verify min-height is applied",
    "Check padding is now 10px top/bottom",
    "Confirm overflow: visible shows all content",
    "Test with long Hebrew text",
    "Verify card expands with content"
  ]
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Could not find old_block" | CSS changed or whitespace mismatch | Provide unminified CSS with exact formatting |
| "Invalid JSON response" | Claude returned explanation text | Check system prompt enforces JSON-only output |
| "Constraint violation" | Patch changes protected properties | Re-run with clearer selector hints |

### Safe Application Pattern

```javascript
try {
  // 1. Validate input
  const inputCheck = validateInput(input);
  if (!inputCheck.valid) throw new Error(inputCheck.errors.join(", "));

  // 2. Call skill
  const result = await fixLayoutIssue(input);

  // 3. Validate output
  const outputCheck = validateOutput(result);
  if (!outputCheck.valid) throw new Error(outputCheck.errors.join(", "));

  // 4. Check constraints
  const constraintCheck = validatePatches(result, input.context.constraints);
  if (!constraintCheck.valid) throw new Error(constraintCheck.violations.join(", "));

  // 5. Apply patches
  const fixed = applyAllPatches({ html, css, patches: result });

  return { success: true, fixed };
} catch (error) {
  return { success: false, error: error.message };
}
```
