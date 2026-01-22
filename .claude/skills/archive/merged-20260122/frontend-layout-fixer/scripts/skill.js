import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Build the user prompt from template and input data
 */
function buildUserPrompt(html, css, context) {
  const selectorHintsList = context.target_selector_hints.join(", ");
  const constraintsList = context.constraints
    .map((c) => `- ${c}`)
    .join("\n");

  const template = `Analyze this front-end layout issue and provide CSS/HTML patches.

=== HTML ===
${html}

=== CSS ===
${css}

=== ISSUE DESCRIPTION ===
${context.issue_description}

=== SELECTOR HINTS ===
These selectors are likely involved (prioritize these when analyzing):
${selectorHintsList}

=== CONSTRAINTS ===
Do NOT violate these requirements:
${constraintsList}

=== VIEWPORT CONTEXT ===
Width: ${context.viewport_width || 1024}px
Height: ${context.viewport_height || 768}px

---

Task: Diagnose the root cause of the layout issue and return CSS/HTML patches in the exact JSON schema format. Be precise about which selectors need changes and why. Include clear rationale for each patch and a testing checklist.`;

  return template;
}

const SYSTEM_PROMPT = `You are an expert front-end layout fixer specializing in CSS and DOM diagnosis.

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
9. Return ONLY valid JSON matching the output schema exactly. No markdown, no explanation outside JSON.

Expected output format (STRICT JSON):
{
  "explanation": "1-3 sentence summary",
  "diagnosis": {
    "root_cause": "identified issue",
    "affected_selectors": ["list of selectors"]
  },
  "css_patches": [
    {
      "selector": ".example",
      "old_block": "exact old CSS",
      "new_block": "exact new CSS",
      "rationale": "why this fixes it"
    }
  ],
  "html_patches": [
    {
      "search": "exact snippet to find",
      "replace": "replacement snippet",
      "rationale": "why needed"
    }
  ],
  "testing_checklist": [
    "test item 1",
    "test item 2"
  ]
}

IMPORTANT: Output ONLY the JSON object. No markdown backticks. No extra text.`;

/**
 * Call the frontend fixer skill
 * @param {Object} input - { html, css, context }
 * @returns {Promise<Object>} - Structured patch response
 */
export async function fixLayoutIssue(input) {
  const { html, css, context } = input;

  if (!html || !css || !context) {
    throw new Error("Missing required fields: html, css, or context");
  }

  const userPrompt = buildUserPrompt(html, css, context);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText = response.content[0].text;

  // Parse JSON response
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(
      `Failed to parse skill response as JSON: ${parseError.message}\n\nResponse: ${responseText}`
    );
  }

  return result;
}

/**
 * Full workflow with error handling
 * @param {Object} input - { html, css, context }
 * @returns {Promise<Object>} - { success, diagnosis, fixed_html, fixed_css, testing_checklist, error? }
 */
export async function fixLayoutWithErrorHandling(input) {
  const { validateInput, validateOutput, validatePatches } = await import("./validator.js");
  const { applyAllPatches } = await import("./patch-applier.js");

  try {
    // Validate input
    const inputCheck = validateInput(input);
    if (!inputCheck.valid) {
      throw new Error(`Invalid input: ${inputCheck.errors.join(", ")}`);
    }

    // Call the skill
    const result = await fixLayoutIssue(input);

    // Validate output structure
    const outputCheck = validateOutput(result);
    if (!outputCheck.valid) {
      throw new Error(`Invalid skill output: ${outputCheck.errors.join(", ")}`);
    }

    // Validate patches don't violate constraints
    const constraintCheck = validatePatches(result, input.context.constraints);
    if (!constraintCheck.valid) {
      throw new Error(`Constraints violated:\n${constraintCheck.violations.join("\n")}`);
    }

    // Apply patches safely
    const fixed = applyAllPatches({
      html: input.html,
      css: input.css,
      patches: result
    });

    return {
      success: true,
      diagnosis: result.diagnosis,
      explanation: result.explanation,
      fixed_html: fixed.html,
      fixed_css: fixed.css,
      testing_checklist: result.testing_checklist
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      input_snapshot: { ...input, html: "[truncated]", css: "[truncated]" }
    };
  }
}

export default fixLayoutIssue;
