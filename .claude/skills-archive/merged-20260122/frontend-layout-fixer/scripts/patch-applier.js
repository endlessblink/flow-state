/**
 * Apply CSS patches to a stylesheet
 * @param {string} currentCss - The current CSS string
 * @param {Array} patches - Array of CSS patches with old_block and new_block
 * @returns {string} - Updated CSS
 */
export function applyCssPatches(currentCss, patches) {
  let result = currentCss;

  for (const patch of patches) {
    if (!result.includes(patch.old_block)) {
      throw new Error(
        `CSS patch failed: Could not find old_block for selector "${patch.selector}"\n\nExpected to find:\n${patch.old_block}\n\nIn current CSS.`
      );
    }

    // Replace only the first occurrence to avoid unintended side effects
    result = result.replace(patch.old_block, patch.new_block);
  }

  return result;
}

/**
 * Apply HTML patches to a document
 * @param {string} currentHtml - The current HTML string
 * @param {Array} patches - Array of HTML patches with search and replace
 * @returns {string} - Updated HTML
 */
export function applyHtmlPatches(currentHtml, patches) {
  let result = currentHtml;

  for (const patch of patches) {
    if (!result.includes(patch.search)) {
      throw new Error(
        `HTML patch failed: Could not find search snippet:\n${patch.search}`
      );
    }

    // Replace only the first occurrence
    result = result.replace(patch.search, patch.replace);
  }

  return result;
}

/**
 * Apply all patches (CSS and HTML) to the source code
 * @param {Object} input - { html, css, patches }
 * @returns {Object} - { html, css } with patches applied
 */
export function applyAllPatches(input) {
  const { html, css, patches } = input;

  if (!patches) {
    throw new Error("No patches provided");
  }

  let newHtml = html;
  let newCss = css;

  // Apply CSS patches
  if (patches.css_patches && patches.css_patches.length > 0) {
    newCss = applyCssPatches(newCss, patches.css_patches);
  }

  // Apply HTML patches
  if (patches.html_patches && patches.html_patches.length > 0) {
    newHtml = applyHtmlPatches(newHtml, patches.html_patches);
  }

  return { html: newHtml, css: newCss };
}

/**
 * Preview patches without applying (dry run)
 * @param {Object} input - { html, css, patches }
 * @returns {Object} - { valid, errors, preview }
 */
export function previewPatches(input) {
  const { html, css, patches } = input;
  const errors = [];
  const preview = {
    css_patches: [],
    html_patches: []
  };

  // Check CSS patches
  if (patches.css_patches) {
    for (const patch of patches.css_patches) {
      if (!css.includes(patch.old_block)) {
        errors.push(`CSS: Could not find old_block for "${patch.selector}"`);
      } else {
        preview.css_patches.push({
          selector: patch.selector,
          found: true,
          rationale: patch.rationale
        });
      }
    }
  }

  // Check HTML patches
  if (patches.html_patches) {
    for (const patch of patches.html_patches) {
      if (!html.includes(patch.search)) {
        errors.push(`HTML: Could not find search snippet`);
      } else {
        preview.html_patches.push({
          found: true,
          rationale: patch.rationale
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    preview
  };
}

export default {
  applyCssPatches,
  applyHtmlPatches,
  applyAllPatches,
  previewPatches
};
