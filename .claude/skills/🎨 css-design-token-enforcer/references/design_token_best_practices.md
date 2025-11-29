# CSS Design Tokens Best Practices

## Industry Standards and Guidelines

This document compiles best practices for CSS design tokens from leading industry sources including Atlassian Design System, Salesforce Lightning, CSS-Tricks, and enterprise design system standards.

## Core Principles

### 1. Single Source of Truth
- **Purpose**: Eliminate hardcoded values and ensure consistency
- **Implementation**: All colors, spacing, typography should reference design tokens
- **Benefit**: Changes propagate automatically across the entire application

### 2. Semantic Naming
- **Good**: `var(--color-priority-medium)`, `var(--surface-primary)`
- **Bad**: `var(--orange-500)`, `var(--bg-white)`
- **Principle**: Names should describe purpose, not appearance

### 3. Consistent Token Structure
```css
/* Category-Specific-Modifier */
--color-priority-medium
--color-priority-high
--surface-primary
--surface-secondary
```

## Color Token Best Practices

### Priority Color System
Based on enterprise design systems, priority colors should follow this structure:

```css
/* Base priority colors */
--color-priority-high: #ef4444;     /* Red - urgent */
--color-priority-medium: #f59e0b;   /* Orange/amber - default */
--color-priority-low: #3b82f6;      /* Blue - low priority */

/* Background variants with consistent opacity */
--priority-high-bg: rgba(239, 68, 68, 0.3);
--priority-medium-bg: rgba(245, 158, 11, 0.3);
--priority-low-bg: rgba(59, 130, 246, 0.3);

/* Glow effects for emphasis */
--priority-high-glow: 0 4px 8px rgba(239, 68, 68, 0.3), 0 0 12px rgba(239, 68, 68, 0.2);
--priority-medium-glow: 0 4px 8px rgba(245, 158, 11, 0.3), 0 0 12px rgba(245, 158, 11, 0.2);
--priority-low-glow: 0 4px 8px rgba(59, 130, 246, 0.3), 0 0 12px rgba(59, 130, 246, 0.2);
```

### Alpha Transparency Standards
- **0.05**: Subtle backgrounds (`-bg-subtle`)
- **0.1**: Light backgrounds (`-bg-light`, `-alpha-10`)
- **0.2**: Borders (`-border-medium`)
- **0.3**: Standard backgrounds (`-bg`)
- **1.0**: Full opacity colors

### Common Anti-Patterns to Avoid

#### 1. Hardcoded Hex Values
```css
/* ❌ WRONG */
.priority-medium {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
}

/* ✅ CORRECT */
.priority-medium {
  background: var(--color-priority-medium);
  box-shadow: var(--priority-medium-glow);
}
```

#### 2. Inconsistent Gradients
```css
/* ❌ WRONG - Creates color inconsistency */
.priority-medium {
  background: linear-gradient(180deg, var(--color-priority-medium) 0%, #feca57 100%);
}

/* ✅ CORRECT - Consistent color */
.priority-medium {
  background: var(--color-priority-medium);
}
```

#### 3. Mixed Approaches
```css
/* ❌ WRONG - Mix of hex and tokens */
.component1 { background: var(--color-priority-medium); }
.component2 { background: #f59e0b; } /* Same color, different approach */

/* ✅ CORRECT - Consistent token usage */
.component1 { background: var(--color-priority-medium); }
.component2 { background: var(--color-priority-medium); }
```

## Component-Level Guidelines

### Vue Components
1. **Avoid inline styles with hex values**
2. **Use CSS classes with token references**
3. **Prefer CSS custom properties over SCSS variables**

### CSS Architecture
1. **Global tokens first** (`--color-priority-medium`)
2. **Component-specific tokens derived from globals**
3. **Utility classes for common patterns**

### Responsive Design
```css
/* ✅ CORRECT - Tokens adapt to themes */
.priority-medium {
  background: var(--color-priority-medium);
  color: var(--on-priority-medium);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-priority-medium: #f59e0b;
    --on-priority-medium: #ffffff;
  }
}
```

## Migration Strategy

### Phase 1: Audit
1. Use automated tools to find all hardcoded values
2. Categorize by priority (urgent, medium, low)
3. Document current color usage patterns

### Phase 2: Replace
1. Start with high-priority colors (priority indicators)
2. Replace hardcoded values with appropriate tokens
3. Test visual consistency across all views

### Phase 3: Validate
1. Automated consistency checks
2. Visual regression testing
3. Cross-browser verification

## Tooling and Automation

### Linting Rules
```json
{
  "rules": {
    "no-hardcoded-colors": "error",
    "prefer-design-tokens": "warn",
    "consistent-token-usage": "error"
  }
}
```

### Build-Time Validation
- Validate no hardcoded hex values remain
- Check token naming conventions
- Ensure consistent opacity levels

### CI/CD Integration
- Automated consistency reports
- Visual regression testing
- Token usage analytics

## Sources and References

1. **Atlassian Design System** - Enterprise color token standards
2. **Salesforce Lightning** - Comprehensive design token methodology
3. **CSS-Tricks** - Design tokens implementation best practices
4. **U.S. Web Design System** - Government-standard token architecture
5. **Enterprise Design Systems** - Industry consistency guidelines

## Quick Reference

### Priority Color Mapping
| Use Case | Token | Hex Value | When to Use |
|----------|-------|-----------|-------------|
| Medium Priority | `var(--color-priority-medium)` | #f59e0b | Default task priority |
| High Priority | `var(--color-priority-high)` | #ef4444 | Urgent tasks |
| Low Priority | `var(--color-priority-low)` | #3b82f6 | Optional tasks |
| Work Focus | `var(--color-work)` | #10b981 | Active work state |

### Common Replacement Patterns
| From | To | Context |
|-------|-----|---------|
| `#f59e0b` | `var(--color-priority-medium)` | Direct color replacement |
| `#feca57` | `var(--color-priority-medium)` | Yellow variant elimination |
| `rgba(245, 158, 11, 0.3)` | `var(--priority-medium-bg)` | Background with opacity |
| `rgba(245, 158, 11, 0.1)` | `var(--color-warning-alpha-10)` | Light background variant |

### Validation Checklist
- [ ] No hardcoded hex values in priority colors
- [ ] Consistent token usage across all components
- [ ] Proper alpha levels for different use cases
- [ ] No color inconsistencies between views
- [ ] All gradients use tokens, not hex values
- [ ] CSS custom properties follow naming conventions