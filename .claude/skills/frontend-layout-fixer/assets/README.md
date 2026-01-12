# Frontend Layout Fixer - Quick Start

Fix frontend layout issues (clipping, spacing, overflow) with structured CSS patches.

## Setup

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY="your-key-here"
```

## Basic Usage

```javascript
import fixLayoutIssue from "./scripts/skill.js";
import { applyAllPatches } from "./scripts/patch-applier.js";

const input = {
  html: `<div class="card"><h2>Title</h2></div>`,
  css: `.card { height: 60px; overflow: hidden; }`,
  context: {
    issue_description: "Text is clipped at top and bottom",
    target_selector_hints: [".card"],
    constraints: ["Do not change colors"],
    viewport_width: 360,
    viewport_height: 800
  }
};

const result = await fixLayoutIssue(input);
const fixed = applyAllPatches({ html: input.html, css: input.css, patches: result });
console.log(fixed.css);
```

## Common Fixes

| Issue | Solution |
|-------|----------|
| Text clipped | `height` -> `min-height`, `overflow: visible` |
| Tight spacing | Increase `padding` |
| RTL text issues | Increase `line-height` to 1.5 |
| Alignment problems | `justify-content: flex-start` |

## Input Schema

```javascript
{
  html: String,           // HTML source
  css: String,            // CSS stylesheet
  context: {
    issue_description: String,        // What's broken
    target_selector_hints: String[],  // CSS selectors to check
    constraints: String[],            // What NOT to change
    viewport_width?: Number,          // Width in px
    viewport_height?: Number          // Height in px
  }
}
```

## Output Schema

```javascript
{
  explanation: String,              // Summary
  diagnosis: {
    root_cause: String,
    affected_selectors: String[]
  },
  css_patches: [{
    selector: String,
    old_block: String,
    new_block: String,
    rationale: String
  }],
  html_patches: [{
    search: String,
    replace: String,
    rationale: String
  }],
  testing_checklist: String[]
}
```

## Best Practices

1. **Provide 3-5 selector hints** - More specific = better results
2. **Specify constraints** - What NOT to change
3. **Include viewport size** - Mobile vs desktop matters
4. **Validate before applying** - Use validator.js functions

## Validation

```javascript
import { validateInput, validateOutput, validatePatches } from "./scripts/validator.js";

const inputCheck = validateInput(input);
const outputCheck = validateOutput(result);
const constraintCheck = validatePatches(result, input.context.constraints);

if (inputCheck.valid && outputCheck.valid && constraintCheck.valid) {
  // Safe to apply
}
```

## Files

- `scripts/skill.js` - Core API caller
- `scripts/patch-applier.js` - Apply patches
- `scripts/validator.js` - Validation functions
- `references/schema.json` - Full JSON schema
- `references/system-prompt.txt` - System prompt
- `references/user-prompt-template.txt` - User prompt template
