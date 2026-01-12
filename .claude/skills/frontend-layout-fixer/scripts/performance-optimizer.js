import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PERF_SYSTEM_PROMPT = `You are an expert frontend performance optimizer specializing in Core Web Vitals.

Your role:
- Analyze HTML, CSS, and JavaScript for performance issues
- Optimize Cumulative Layout Shift (CLS) - target < 0.1
- Optimize First Contentful Paint (FCP) - target < 1.8s
- Optimize Largest Contentful Paint (LCP) - target < 2.5s
- Optimize First Input Delay (FID) / Interaction to Next Paint (INP) - target < 100ms
- Identify render-blocking resources, layout thrashing, and inefficient rendering

Rules:
1. Always provide severity level: "critical", "high", "medium", or "low"
2. Identify the specific metric being impacted (CLS, FCP, LCP, FID, INP)
3. Include "rationale" explaining the performance impact
4. Provide estimated metric improvements
5. Prioritize fixes by impact
6. Return ONLY valid JSON matching the schema exactly

Core Web Vitals Thresholds:
- CLS: Good < 0.1, Needs Improvement 0.1-0.25, Poor > 0.25
- FCP: Good < 1.8s, Needs Improvement 1.8-3s, Poor > 3s
- LCP: Good < 2.5s, Needs Improvement 2.5-4s, Poor > 4s
- FID: Good < 100ms, Needs Improvement 100-300ms, Poor > 300ms

Output format (STRICT JSON):
{
  "skill_type": "performance",
  "explanation": "summary of performance issues",
  "diagnosis": {
    "severity": "critical|high|medium|low",
    "metrics_impacted": ["CLS", "LCP", "FCP", "FID"],
    "root_causes": ["cause 1", "cause 2"],
    "affected_resources": ["resource 1", "resource 2"]
  },
  "fixes": {
    "html_patches": [
      { "search": "old html", "replace": "new html", "rationale": "why", "metric_impact": "CLS" }
    ],
    "css_patches": [
      { "selector": ".class", "old_block": "old css", "new_block": "new css", "rationale": "why" }
    ],
    "javascript_patches": [
      { "old_code": "old js", "new_code": "new js", "rationale": "why" }
    ]
  },
  "performance_impact": {
    "cls": "0.25 → 0.05",
    "fcp": "2.5s → 1.2s",
    "lcp": "3.8s → 2.1s"
  },
  "recommendations": [
    "Add loading='lazy' to below-fold images",
    "Preload critical fonts",
    "Defer non-critical JavaScript"
  ],
  "testing_checklist": [
    "Run Lighthouse audit",
    "Check CLS in DevTools Performance tab",
    "Test on slow 3G network"
  ]
}

IMPORTANT: Output ONLY the JSON object. No markdown. No extra text.`;

/**
 * Build user prompt for performance optimization
 */
function buildPerfPrompt(html, css, javascript, issueDescription, context) {
  const metrics = context?.current_metrics || {};

  return `Analyze this code for performance issues and provide optimizations.

=== HTML ===
${html || "(no HTML provided)"}

=== CSS ===
${css || "(no CSS provided)"}

=== JAVASCRIPT ===
${javascript || "(no JavaScript provided)"}

=== ISSUE DESCRIPTION ===
${issueDescription}

=== CURRENT METRICS ===
CLS: ${metrics.cls || "unknown"}
FCP: ${metrics.fcp || "unknown"}
LCP: ${metrics.lcp || "unknown"}
FID: ${metrics.fid || "unknown"}

=== CONSTRAINTS ===
${(context?.constraints || []).map(c => `- ${c}`).join("\n") || "- None specified"}

Diagnose performance issues and return optimizations in JSON format.`;
}

/**
 * Fix performance issues
 * @param {Object} input - { html?, css?, javascript?, issue_description, context? }
 * @returns {Promise<Object>} - Performance fix result
 */
export async function fixPerformance(input) {
  const { html, css, javascript, issue_description, context } = input;

  if (!issue_description) {
    throw new Error("Missing required field: issue_description");
  }

  if (!html && !css && !javascript) {
    throw new Error("At least one of html, css, or javascript must be provided");
  }

  const userPrompt = buildPerfPrompt(html, css, javascript, issue_description, context);

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    system: PERF_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = response.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse performance response: ${parseError.message}`);
  }
}

/**
 * Validate performance optimizer input
 */
export function validatePerfInput(input) {
  const errors = [];

  if (!input.issue_description || typeof input.issue_description !== "string") {
    errors.push("Missing or invalid 'issue_description' field");
  }
  if (!input.html && !input.css && !input.javascript) {
    errors.push("At least one of 'html', 'css', or 'javascript' must be provided");
  }
  if (input.context?.current_metrics) {
    const metrics = input.context.current_metrics;
    if (metrics.cls !== undefined && (typeof metrics.cls !== "number" || metrics.cls < 0)) {
      errors.push("'current_metrics.cls' must be a non-negative number");
    }
    if (metrics.fcp !== undefined && (typeof metrics.fcp !== "number" || metrics.fcp < 0)) {
      errors.push("'current_metrics.fcp' must be a non-negative number (seconds)");
    }
    if (metrics.lcp !== undefined && (typeof metrics.lcp !== "number" || metrics.lcp < 0)) {
      errors.push("'current_metrics.lcp' must be a non-negative number (seconds)");
    }
    if (metrics.fid !== undefined && (typeof metrics.fid !== "number" || metrics.fid < 0)) {
      errors.push("'current_metrics.fid' must be a non-negative number (ms)");
    }
  }

  return { valid: errors.length === 0, errors };
}

export default { fixPerformance, validatePerfInput };
