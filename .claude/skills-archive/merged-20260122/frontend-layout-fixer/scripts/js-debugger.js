import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const JS_DEBUGGER_SYSTEM_PROMPT = `You are an expert JavaScript debugger specializing in frontend issues.

Your role:
- Analyze JavaScript code for bugs, logic errors, and runtime issues
- Identify event handler problems, promise failures, and memory leaks
- Debug framework-specific issues (React, Vue, vanilla JS, Next.js, Nuxt)
- Find scope issues, timing problems, and state management bugs

Rules:
1. Always provide severity level: "critical", "high", "medium", or "low"
2. Identify the specific error type (e.g., "event handler not firing", "promise rejection", "memory leak")
3. Include "rationale" explaining why the bug occurs
4. Provide framework-specific fixes when applicable
5. Include debugging steps and console.log recommendations
6. Return ONLY valid JSON matching the schema exactly

Output format (STRICT JSON):
{
  "skill_type": "javascript",
  "explanation": "summary of the JavaScript issue",
  "diagnosis": {
    "severity": "critical|high|medium|low",
    "error_type": "event handler|promise|memory leak|logic error|timing|scope",
    "root_causes": ["cause 1", "cause 2"],
    "affected_functions": ["function1", "function2"],
    "framework": "react|vue|vanilla|nextjs|nuxt|unknown"
  },
  "fixes": {
    "javascript_patches": [
      {
        "old_code": "exact old code",
        "new_code": "exact new code",
        "rationale": "why this fixes it",
        "line_hint": "approximate location"
      }
    ],
    "html_patches": [
      { "search": "old html", "replace": "new html", "rationale": "why" }
    ]
  },
  "debugging_steps": [
    "Add console.log to X",
    "Check DevTools Network tab",
    "Inspect element event listeners"
  ],
  "testing_checklist": [
    "Verify event fires on click",
    "Check console for errors",
    "Test in incognito mode"
  ]
}

IMPORTANT: Output ONLY the JSON object. No markdown. No extra text.`;

/**
 * Build user prompt for JavaScript debugging
 */
function buildJSPrompt(javascript, html, issueDescription, context) {
  const projectType = context?.project_type || "vanilla";

  return `Debug this JavaScript code and provide fixes.

=== JAVASCRIPT ===
${javascript}

=== HTML (if relevant) ===
${html || "(no HTML provided)"}

=== ISSUE DESCRIPTION ===
${issueDescription}

=== PROJECT TYPE ===
Framework: ${projectType}

=== CONSTRAINTS ===
${(context?.constraints || []).map(c => `- ${c}`).join("\n") || "- None specified"}

=== ADDITIONAL CONTEXT ===
${context?.additional_context || "None"}

Diagnose the JavaScript issue and return fixes in JSON format.`;
}

/**
 * Fix JavaScript issues
 * @param {Object} input - { javascript, html?, issue_description, context? }
 * @returns {Promise<Object>} - JavaScript fix result
 */
export async function fixJavaScript(input) {
  const { javascript, html, issue_description, context } = input;

  if (!javascript || !issue_description) {
    throw new Error("Missing required fields: javascript and issue_description");
  }

  const userPrompt = buildJSPrompt(javascript, html, issue_description, context);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    system: JS_DEBUGGER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = response.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse JS debugger response: ${parseError.message}`);
  }
}

/**
 * Validate JavaScript debugger input
 */
export function validateJSInput(input) {
  const errors = [];

  if (!input.javascript || typeof input.javascript !== "string") {
    errors.push("Missing or invalid 'javascript' field");
  }
  if (!input.issue_description || typeof input.issue_description !== "string") {
    errors.push("Missing or invalid 'issue_description' field");
  }
  if (input.context?.project_type) {
    const validTypes = ["react", "vue", "vanilla", "nextjs", "nuxt", "svelte", "angular"];
    if (!validTypes.includes(input.context.project_type)) {
      errors.push(`'project_type' must be one of: ${validTypes.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export default { fixJavaScript, validateJSInput };
