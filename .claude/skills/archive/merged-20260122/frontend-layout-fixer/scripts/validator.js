/**
 * Validate that patches do not violate constraints
 * @param {Object} patches - The patches object with css_patches and html_patches
 * @param {Array<string>} constraints - Array of constraint strings
 * @returns {Object} - { valid: boolean, violations: string[] }
 */
export function validatePatches(patches, constraints) {
  const violations = [];

  if (!patches || !constraints) {
    return { valid: true, violations: [] };
  }

  const constraintText = constraints.join(" ").toLowerCase();

  // Check typography constraints
  if (
    constraintText.includes("do not change") &&
    (constraintText.includes("typography") || constraintText.includes("fonts"))
  ) {
    const typographyPatterns = [
      /font-size:/i,
      /font-weight:/i,
      /letter-spacing:/i,
      /font-family:/i,
    ];

    for (const patch of patches.css_patches || []) {
      for (const pattern of typographyPatterns) {
        // Check if new_block has a different value than old_block
        const oldMatch = patch.old_block.match(pattern);
        const newMatch = patch.new_block.match(pattern);

        if (newMatch && !oldMatch) {
          violations.push(
            `Patch for "${patch.selector}" adds typography property despite constraint`
          );
        } else if (oldMatch && newMatch) {
          // Extract values and compare
          const oldValue = patch.old_block.match(new RegExp(pattern.source + "\\s*([^;]+)", "i"));
          const newValue = patch.new_block.match(new RegExp(pattern.source + "\\s*([^;]+)", "i"));
          if (oldValue && newValue && oldValue[1].trim() !== newValue[1].trim()) {
            violations.push(
              `Patch for "${patch.selector}" modifies typography despite constraint`
            );
          }
        }
      }
    }
  }

  // Check color constraints
  if (constraintText.includes("do not change") && constraintText.includes("color")) {
    const colorPatterns = [
      /(?:^|\s)color:/i,
      /background-color:/i,
      /border-color:/i,
      /border:.*#/i,
    ];

    for (const patch of patches.css_patches || []) {
      for (const pattern of colorPatterns) {
        const oldMatch = patch.old_block.match(pattern);
        const newMatch = patch.new_block.match(pattern);

        if (newMatch && !oldMatch) {
          violations.push(
            `Patch for "${patch.selector}" adds color property despite constraint`
          );
        } else if (oldMatch && newMatch) {
          // Extract color values
          const oldColorMatch = patch.old_block.match(/color:\s*([^;]+)/i);
          const newColorMatch = patch.new_block.match(/color:\s*([^;]+)/i);

          if (oldColorMatch && newColorMatch && oldColorMatch[1].trim() !== newColorMatch[1].trim()) {
            violations.push(
              `Patch for "${patch.selector}" changes color despite constraint`
            );
          }
        }
      }
    }
  }

  // Check layout direction constraints
  if (
    constraintText.includes("preserve") &&
    constraintText.includes("layout") &&
    (constraintText.includes("direction") || constraintText.includes("structure"))
  ) {
    const layoutPatterns = [/flex-direction:/i, /direction:/i, /writing-mode:/i];

    for (const patch of patches.css_patches || []) {
      for (const pattern of layoutPatterns) {
        const oldMatch = patch.old_block.match(pattern);
        const newMatch = patch.new_block.match(pattern);

        if (oldMatch && newMatch) {
          const oldVal = patch.old_block.match(new RegExp(pattern.source + "\\s*([^;]+)", "i"));
          const newVal = patch.new_block.match(new RegExp(pattern.source + "\\s*([^;]+)", "i"));

          if (oldVal && newVal && oldVal[1].trim() !== newVal[1].trim()) {
            violations.push(
              `Patch for "${patch.selector}" changes layout direction despite constraint`
            );
          }
        }
      }
    }
  }

  // Check animation constraints
  if (constraintText.includes("animation") || constraintText.includes("transition")) {
    const animationPatterns = [/animation:/i, /transition:/i, /@keyframes/i];

    for (const patch of patches.css_patches || []) {
      for (const pattern of animationPatterns) {
        const oldMatch = patch.old_block.match(pattern);
        const newMatch = patch.new_block.match(pattern);

        if (oldMatch && !newMatch) {
          violations.push(
            `Patch for "${patch.selector}" removes animation/transition despite constraint`
          );
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validate input structure
 * @param {Object} input - The input object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateInput(input) {
  const errors = [];

  if (!input.html || typeof input.html !== "string") {
    errors.push("Missing or invalid 'html' field");
  }

  if (!input.css || typeof input.css !== "string") {
    errors.push("Missing or invalid 'css' field");
  }

  if (!input.context || typeof input.context !== "object") {
    errors.push("Missing or invalid 'context' field");
  } else {
    if (!input.context.issue_description) {
      errors.push("Missing 'context.issue_description'");
    }
    if (!Array.isArray(input.context.target_selector_hints)) {
      errors.push("Missing or invalid 'context.target_selector_hints' array");
    } else if (input.context.target_selector_hints.length === 0) {
      errors.push("'context.target_selector_hints' must have at least 1 selector");
    }
    if (!Array.isArray(input.context.constraints)) {
      errors.push("Missing or invalid 'context.constraints' array");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate output structure from the skill
 * @param {Object} output - The output object from the skill
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateOutput(output) {
  const errors = [];

  if (!output.explanation || typeof output.explanation !== "string") {
    errors.push("Missing or invalid 'explanation' field");
  }

  if (!output.diagnosis || typeof output.diagnosis !== "object") {
    errors.push("Missing or invalid 'diagnosis' field");
  } else {
    if (!output.diagnosis.root_cause) {
      errors.push("Missing 'diagnosis.root_cause'");
    }
    if (!Array.isArray(output.diagnosis.affected_selectors)) {
      errors.push("Missing or invalid 'diagnosis.affected_selectors' array");
    }
  }

  if (!Array.isArray(output.css_patches)) {
    errors.push("Missing or invalid 'css_patches' array");
  } else {
    for (let i = 0; i < output.css_patches.length; i++) {
      const patch = output.css_patches[i];
      if (!patch.selector) errors.push(`css_patches[${i}] missing 'selector'`);
      if (!patch.old_block) errors.push(`css_patches[${i}] missing 'old_block'`);
      if (!patch.new_block) errors.push(`css_patches[${i}] missing 'new_block'`);
      if (!patch.rationale) errors.push(`css_patches[${i}] missing 'rationale'`);
    }
  }

  if (!Array.isArray(output.html_patches)) {
    errors.push("Missing or invalid 'html_patches' array");
  } else {
    for (let i = 0; i < output.html_patches.length; i++) {
      const patch = output.html_patches[i];
      if (!patch.search) errors.push(`html_patches[${i}] missing 'search'`);
      if (!patch.replace) errors.push(`html_patches[${i}] missing 'replace'`);
      if (!patch.rationale) errors.push(`html_patches[${i}] missing 'rationale'`);
    }
  }

  if (!Array.isArray(output.testing_checklist)) {
    errors.push("Missing or invalid 'testing_checklist' array");
  } else if (output.testing_checklist.length < 1) {
    errors.push("'testing_checklist' must have at least 1 item");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive validation of the entire workflow
 * @param {Object} input - The input object
 * @param {Object} output - The output object from the skill
 * @returns {Object} - { valid: boolean, inputErrors: string[], outputErrors: string[], constraintViolations: string[] }
 */
export function validateWorkflow(input, output) {
  const inputValidation = validateInput(input);
  const outputValidation = validateOutput(output);
  const constraintValidation = validatePatches(output, input?.context?.constraints || []);

  return {
    valid: inputValidation.valid && outputValidation.valid && constraintValidation.valid,
    inputErrors: inputValidation.errors,
    outputErrors: outputValidation.errors,
    constraintViolations: constraintValidation.violations
  };
}

export default {
  validatePatches,
  validateInput,
  validateOutput,
  validateWorkflow
};
