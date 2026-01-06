# Design System

## Design Tokens
Located in `src/assets/design-tokens.css`:
- Color system with CSS custom properties
- Typography scale and spacing system
- Animation timing functions
- Shadow and border radius libraries

## Tailwind Configuration
**Extensive customization** (`tailwind.config.js`):
- Custom color palette mapped to design tokens
- Component classes (`.task-base`, `.btn`, etc.)
- Canvas-specific utilities
- GPU acceleration helpers

## Glass Morphism Theme
- Consistent dark/light mode support
- Backdrop filters for modern glass effects
- Smooth transitions between themes
- CSS custom property integration

## UI Component & Design Token Standards

**All design tokens are defined in:**
`.claude/skills/css-design-token-enforcer/assets/token_definitions.json`

### Mandatory Components

| Component Type | Standard Component | Key Rule |
|----------------|-------------------|----------|
| **Dropdowns** | `CustomSelect.vue` | NEVER use native `<select>` |
| **Context Menus** | `ContextMenu.vue` | NEVER use browser context menus |
| **Modals** | `BaseModal.vue`, `BasePopover.vue` | Dark glass morphism required |

**When user says "fix dropdowns"** → Replace native `<select>` with `CustomSelect` component

### Token Categories
- Priority colors (`--color-priority-high`, `--color-priority-medium`, `--color-priority-low`)
- UI component specs (dropdown, context menu, modal backgrounds/borders/shadows)
- Alpha variants and glow effects
- Enforcement rules and forbidden patterns

See `token_definitions.json` for complete specifications
