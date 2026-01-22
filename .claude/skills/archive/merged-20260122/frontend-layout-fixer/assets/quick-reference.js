#!/usr/bin/env node

/**
 * Frontend Layout Fixer - Quick Reference Templates
 *
 * Copy-paste examples for common layout issues.
 */

// =============================================================================
// TEMPLATE 1: Basic Clipping Fix
// =============================================================================

const clippingExample = {
  html: `
    <div class="card">
      <h2 class="card-title">Title text here</h2>
      <p class="card-meta">Subtitle or meta info</p>
    </div>
  `,
  css: `
    .card {
      height: 60px;
      overflow: hidden;
      padding: 4px 12px;
    }
    .card-title {
      font-size: 14px;
      line-height: 1.2;
    }
  `,
  context: {
    issue_description: "Text is clipped at top and bottom of card",
    target_selector_hints: [".card", ".card-title", ".card-meta"],
    constraints: ["Do not change colors", "Do not change fonts"],
    viewport_width: 360,
    viewport_height: 800
  }
};

// =============================================================================
// TEMPLATE 2: RTL Text Issues
// =============================================================================

const rtlExample = {
  html: `
    <div class="task-item">
      <span class="task-title" dir="rtl">טקסט בעברית כאן</span>
      <span class="task-date">Jan 12</span>
    </div>
  `,
  css: `
    .task-item {
      display: flex;
      justify-content: space-between;
      height: 40px;
      overflow: hidden;
    }
    .task-title {
      line-height: 1.0;
    }
  `,
  context: {
    issue_description: "Hebrew text is cut off. Letters are not fully visible at top.",
    target_selector_hints: [".task-item", ".task-title"],
    constraints: ["Preserve RTL support", "Do not change colors"],
    viewport_width: 360,
    viewport_height: 800
  }
};

// =============================================================================
// TEMPLATE 3: Flex Container Overflow
// =============================================================================

const flexOverflowExample = {
  html: `
    <div class="container">
      <div class="sidebar">Sidebar</div>
      <div class="content">Main content area with lots of text that might overflow</div>
    </div>
  `,
  css: `
    .container {
      display: flex;
      width: 100%;
      height: 400px;
      overflow: hidden;
    }
    .sidebar {
      width: 200px;
      flex-shrink: 0;
    }
    .content {
      flex: 1;
      overflow: hidden;
    }
  `,
  context: {
    issue_description: "Content is cut off on the right side. Should scroll or wrap.",
    target_selector_hints: [".container", ".sidebar", ".content"],
    constraints: ["Keep sidebar width fixed", "Do not change colors"],
    viewport_width: 768,
    viewport_height: 1024
  }
};

// =============================================================================
// TEMPLATE 4: Grid Layout Spacing
// =============================================================================

const gridSpacingExample = {
  html: `
    <div class="grid">
      <div class="grid-item">Item 1</div>
      <div class="grid-item">Item 2</div>
      <div class="grid-item">Item 3</div>
      <div class="grid-item">Item 4</div>
    </div>
  `,
  css: `
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2px;
    }
    .grid-item {
      padding: 2px;
      height: 50px;
    }
  `,
  context: {
    issue_description: "Grid items are too close together. Need more spacing.",
    target_selector_hints: [".grid", ".grid-item"],
    constraints: ["Keep 2-column layout", "Do not change background colors"],
    viewport_width: 360,
    viewport_height: 800
  }
};

// =============================================================================
// USAGE FUNCTION
// =============================================================================

async function runExample(name, input) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`EXAMPLE: ${name}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("Input:");
  console.log(JSON.stringify(input, null, 2));

  try {
    const { fixLayoutIssue } = await import("../scripts/skill.js");
    const { applyAllPatches } = await import("../scripts/patch-applier.js");
    const { validateOutput, validatePatches } = await import("../scripts/validator.js");

    console.log("\nCalling skill...");
    const result = await fixLayoutIssue(input);

    console.log("\nDiagnosis:");
    console.log(`  Root Cause: ${result.diagnosis.root_cause}`);
    console.log(`  Affected: ${result.diagnosis.affected_selectors.join(", ")}`);

    console.log("\nExplanation:");
    console.log(`  ${result.explanation}`);

    // Validate
    const outputCheck = validateOutput(result);
    const constraintCheck = validatePatches(result, input.context.constraints);

    if (!outputCheck.valid) {
      console.error("\nOutput validation failed:", outputCheck.errors);
      return;
    }

    if (!constraintCheck.valid) {
      console.error("\nConstraint violations:", constraintCheck.violations);
      return;
    }

    // Apply patches
    const fixed = applyAllPatches({
      html: input.html,
      css: input.css,
      patches: result
    });

    console.log("\nFixed CSS:");
    console.log(fixed.css);

    console.log("\nTesting Checklist:");
    result.testing_checklist.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item}`);
    });

  } catch (error) {
    console.error("\nError:", error.message);
    console.log("\nNote: Requires ANTHROPIC_API_KEY environment variable");
  }
}

// =============================================================================
// QUICK PATTERNS REFERENCE
// =============================================================================

const quickPatterns = `
QUICK FIX PATTERNS
==================

1. CLIPPING (Fixed Height)
   Problem:  height: 60px; overflow: hidden;
   Solution: min-height: 60px; overflow: visible;

2. TIGHT VERTICAL SPACING
   Problem:  padding: 2px 8px;
   Solution: padding: 8px 12px;

3. RTL TEXT CUT OFF
   Problem:  line-height: 1.0;
   Solution: line-height: 1.5;

4. VERTICAL CENTERING CLIPS
   Problem:  height: 60px; justify-content: center;
   Solution: min-height: 60px; justify-content: flex-start;

5. FLEX ITEM OVERFLOW
   Problem:  flex: 1; overflow: hidden;
   Solution: flex: 1; overflow: auto; min-width: 0;

6. GRID GAP TOO SMALL
   Problem:  gap: 2px;
   Solution: gap: 8px; OR gap: 1rem;

7. TEXT WRAPPING ISSUES
   Problem:  white-space: nowrap;
   Solution: white-space: normal; word-wrap: break-word;

8. ABSOLUTE POSITION OVERFLOW
   Problem:  position: absolute; (without boundaries)
   Solution: Add position: relative; to parent, set boundaries
`;

// =============================================================================
// MAIN
// =============================================================================

const examples = {
  clipping: clippingExample,
  rtl: rtlExample,
  "flex-overflow": flexOverflowExample,
  "grid-spacing": gridSpacingExample
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help") {
    console.log(`
Frontend Layout Fixer - Quick Reference

Usage:
  node quick-reference.js [example-name]
  node quick-reference.js --patterns

Examples:
  node quick-reference.js clipping
  node quick-reference.js rtl
  node quick-reference.js flex-overflow
  node quick-reference.js grid-spacing
  node quick-reference.js --patterns

Available examples: ${Object.keys(examples).join(", ")}
    `);
    return;
  }

  if (args[0] === "--patterns") {
    console.log(quickPatterns);
    return;
  }

  const exampleName = args[0];
  const example = examples[exampleName];

  if (!example) {
    console.error(`Unknown example: ${exampleName}`);
    console.log(`Available: ${Object.keys(examples).join(", ")}`);
    return;
  }

  await runExample(exampleName, example);
}

// Run if executed directly
if (process.argv[1]?.endsWith("quick-reference.js")) {
  main().catch(console.error);
}

export { examples, quickPatterns, clippingExample, rtlExample, flexOverflowExample, gridSpacingExample };
