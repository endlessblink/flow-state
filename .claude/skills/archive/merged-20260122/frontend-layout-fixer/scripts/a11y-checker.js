import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const A11Y_SYSTEM_PROMPT = `You are an expert accessibility (a11y) auditor specializing in WCAG 2.1 guidelines.

Your role:
- Analyze HTML and CSS for accessibility issues
- Check color contrast ratios (WCAG AA: 4.5:1 text, 3:1 large text; AAA: 7:1 text, 4.5:1 large text)
- Identify missing labels, ARIA attributes, and semantic markup
- Check keyboard navigation and focus management
- Ensure screen reader compatibility

Rules:
1. Always provide severity level: "critical", "high", "medium", or "low"
2. Reference specific WCAG success criteria (e.g., "1.4.3 Contrast (Minimum)")
3. Include "rationale" explaining the accessibility impact
4. Prefer HTML semantic fixes over ARIA when possible
5. Provide testing steps using screen readers and keyboard navigation
6. Return ONLY valid JSON matching the schema exactly

Output format (STRICT JSON):
{
  "skill_type": "a11y",
  "explanation": "summary of accessibility issues found",
  "diagnosis": {
    "severity": "critical|high|medium|low",
    "wcag_violations": ["1.4.3 Contrast", "4.1.2 Name, Role, Value"],
    "root_causes": ["cause 1", "cause 2"],
    "affected_elements": ["selector 1", "selector 2"]
  },
  "fixes": {
    "html_patches": [
      { "search": "old html", "replace": "new html", "rationale": "why", "wcag_criterion": "1.4.3" }
    ],
    "css_patches": [
      { "selector": ".class", "old_block": "old css", "new_block": "new css", "rationale": "why" }
    ]
  },
  "wcag_score": {
    "before": "estimated compliance %",
    "after": "estimated compliance %"
  },
  "testing_checklist": [
    "Test with screen reader (VoiceOver/NVDA)",
    "Tab through all interactive elements",
    "Check color contrast with tool"
  ]
}

IMPORTANT: Output ONLY the JSON object. No markdown. No extra text.`;

/**
 * Build user prompt for accessibility check
 */
function buildA11yPrompt(html, css, issueDescription, context) {
  const level = context?.accessibility_level || "AA";

  return `Analyze this HTML/CSS for accessibility issues and provide fixes.

=== HTML ===
${html}

=== CSS ===
${css || "(no CSS provided)"}

=== ISSUE DESCRIPTION ===
${issueDescription}

=== ACCESSIBILITY LEVEL ===
Target: WCAG 2.1 Level ${level}

=== CONSTRAINTS ===
${(context?.constraints || []).map(c => `- ${c}`).join("\n") || "- None specified"}

Diagnose accessibility issues and return fixes in JSON format.`;
}

/**
 * Fix accessibility issues
 * @param {Object} input - { html, css?, issue_description, context? }
 * @returns {Promise<Object>} - Accessibility fix result
 */
export async function fixA11y(input) {
  const { html, css, issue_description, context } = input;

  if (!html || !issue_description) {
    throw new Error("Missing required fields: html and issue_description");
  }

  const userPrompt = buildA11yPrompt(html, css, issue_description, context);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    system: A11Y_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = response.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse a11y response: ${parseError.message}`);
  }
}

/**
 * Validate accessibility input
 */
export function validateA11yInput(input) {
  const errors = [];

  if (!input.html || typeof input.html !== "string") {
    errors.push("Missing or invalid 'html' field");
  }
  if (!input.issue_description || typeof input.issue_description !== "string") {
    errors.push("Missing or invalid 'issue_description' field");
  }
  if (input.context?.accessibility_level && !["A", "AA", "AAA"].includes(input.context.accessibility_level)) {
    errors.push("'accessibility_level' must be 'A', 'AA', or 'AAA'");
  }

  return { valid: errors.length === 0, errors };
}

export default { fixA11y, validateA11yInput };
