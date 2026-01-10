# Theming & CSS in Vue Flow

Source: https://vueflow.dev/guide/theming.html

Vue Flow is designed to be highly customizable, allowing you to use CSS rules, style/class properties, and CSS variables to match your application's design.

## Library Styles

To initialize Vue Flow with the default look, you must import the core styles and the optional default theme.

```css
/* Necessary core styles */
@import '@vue-flow/core/dist/style.css';

/* Optional default theme */
@import '@vue-flow/core/dist/theme-default.css';
```

## Styling Methods

### 1. CSS Classes
You can target built-in classes to override styles.

```css
/* Customizing a specific node type */
.vue-flow__node-custom {
  background: #1a1a1a;
  color: #fff;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px;
}
```

### 2. Component Props
Pass `class` or `style` directly to the `<VueFlow />` component or individual node/edge objects.

```vue
<VueFlow
  :nodes="nodes"
  class="my-custom-canvas"
  :style="{ background: 'var(--bg-color)' }"
/>
```

```javascript
const nodes = ref([
  {
    id: '1',
    label: 'Styled Node',
    class: 'premium-node',
    style: { backgroundColor: '#f0f0f0', border: '2px solid blue' }
  }
])
```

### 3. CSS Variables
Vue Flow uses CSS variables for many components, allowing for easy global or local adjustments.

```css
:root {
  --vf-node-bg: #fff;
  --vf-node-text: #222;
  --vf-connection-path: #b1b1b7;
  --vf-handle: #555;
  --vf-node-color: #3f51b5; /* Primary color for borders/handles */
}
```

## Key Class Names
- `.vue-flow__container`: The main wrapper.
- `.vue-flow__pane`: The draggable background area.
- `.vue-flow__node`: Base class for all nodes.
- `.vue-flow__edge`: Base class for all edges.
- `.vue-flow__handle`: Connection points.
