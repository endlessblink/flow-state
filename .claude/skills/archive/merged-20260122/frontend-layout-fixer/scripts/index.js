/**
 * Frontend Fixer Skill Suite
 *
 * A comprehensive frontend debugging and fixing toolkit.
 *
 * Available skills:
 * - Layout Fixer: Fix clipping, spacing, overflow, RTL text issues
 * - A11y Checker: Fix accessibility issues (WCAG A/AA/AAA)
 * - JS Debugger: Fix JavaScript bugs and logic errors
 * - Performance Optimizer: Fix Core Web Vitals (CLS, FCP, LCP, FID)
 */

// Layout Fixer (core skill)
export { fixLayoutIssue, fixLayoutWithErrorHandling } from "./skill.js";

// Accessibility Checker
export { fixA11y, validateA11yInput } from "./a11y-checker.js";

// JavaScript Debugger
export { fixJavaScript, validateJSInput } from "./js-debugger.js";

// Performance Optimizer
export { fixPerformance, validatePerfInput } from "./performance-optimizer.js";

// Patch Application
export {
  applyCssPatches,
  applyHtmlPatches,
  applyAllPatches,
  previewPatches
} from "./patch-applier.js";

// Validation
export {
  validateInput,
  validateOutput,
  validatePatches,
  validateWorkflow
} from "./validator.js";

/**
 * Unified frontend fixer
 * Automatically detects the issue type and routes to the appropriate skill
 *
 * @param {Object} input - Universal input object
 * @param {string} input.issue_description - Description of the issue
 * @param {string} input.html - HTML code (optional)
 * @param {string} input.css - CSS code (optional)
 * @param {string} input.javascript - JavaScript code (optional)
 * @param {Object} input.context - Additional context (optional)
 * @returns {Promise<Object>} - Fix result from the appropriate skill
 */
export async function fixFrontendIssue(input) {
  const { issue_description = "", html, css, javascript, context } = input;
  const desc = issue_description.toLowerCase();

  // Route to appropriate skill based on issue description
  if (
    desc.includes("accessibility") ||
    desc.includes("a11y") ||
    desc.includes("wcag") ||
    desc.includes("screen reader") ||
    desc.includes("contrast") ||
    desc.includes("aria") ||
    desc.includes("label")
  ) {
    const { fixA11y } = await import("./a11y-checker.js");
    return fixA11y({ html, css, issue_description, context });
  }

  if (
    desc.includes("performance") ||
    desc.includes("cls") ||
    desc.includes("lcp") ||
    desc.includes("fcp") ||
    desc.includes("fid") ||
    desc.includes("core web vitals") ||
    desc.includes("lighthouse") ||
    desc.includes("slow")
  ) {
    const { fixPerformance } = await import("./performance-optimizer.js");
    return fixPerformance({ html, css, javascript, issue_description, context });
  }

  if (
    desc.includes("javascript") ||
    desc.includes("event handler") ||
    desc.includes("click not working") ||
    desc.includes("promise") ||
    desc.includes("memory leak") ||
    desc.includes("function") ||
    javascript
  ) {
    const { fixJavaScript } = await import("./js-debugger.js");
    return fixJavaScript({ javascript, html, issue_description, context });
  }

  // Default to layout fixer
  const { fixLayoutIssue } = await import("./skill.js");
  return fixLayoutIssue({
    html,
    css,
    context: {
      issue_description,
      target_selector_hints: context?.target_selector_hints || [],
      constraints: context?.constraints || [],
      viewport_width: context?.viewport_width,
      viewport_height: context?.viewport_height,
      ...context
    }
  });
}

export default {
  // Core skills
  fixLayoutIssue,
  fixA11y,
  fixJavaScript,
  fixPerformance,

  // Unified interface
  fixFrontendIssue,

  // Utilities
  applyCssPatches,
  applyHtmlPatches,
  applyAllPatches,
  previewPatches,
  validateInput,
  validateOutput,
  validatePatches,
  validateWorkflow
};
