# Node Interface

Source: https://vueflow.dev/typedocs/interfaces/Node.html

The `Node` interface defines the structure of a node in Vue Flow.

## Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the node. |
| `position` | `XYPosition` | The absolute position of the node. |
| `data?` | `Data` | Custom data associated with the node. |
| `type?` | `Type` | Custom node type. |
| `draggable?` | `boolean` | Whether the node is draggable. |
| `selectable?` | `boolean` | Whether the node is selectable. |
| `connectable?` | `boolean` | Whether the node is connectable. |
| `deletable?` | `boolean` | Whether the node is deletable. |
| `dragHandle?` | `string` | Selector for the drag handle. |
| `parentNode?` | `string` | ID of the parent node (for nesting). |
| `expandParent?` | `boolean` | Whether parent should expand to fit this child. |
| `extent?` | `'parent' \| CoordinateExtent` | Boundaries for node movement. |
| `width?` | `number \| string` | Width of the node. |
| `height?` | `number \| string` | Height of the node. |
| `hidden?` | `boolean` | Whether the node is hidden. |
| `style?` | `CSSProperties` | Custom styles for the node. |
| `class?` | `string \| string[] \| Record<string, boolean>` | Custom CSS classes. |
| `zIndex?` | `number` | Z-index of the node. |
| `ariaLabel?` | `string` | Accessibility label. |
| `focusable?` | `boolean` | Whether the node can be focused. |
| `isValidSourcePos?` | `ValidConnectionFunc` | Validation for source connections. |
| `isValidTargetPos?` | `ValidConnectionFunc` | Validation for target connections. |
| `label?` | `string \| VNode \| Component` | Optional label for the node. |
| `sourcePosition?` | `Position` | Position of the source handle. |
| `targetPosition?` | `Position` | Position of the target handle. |
| `template?` | `Component` | Custom template for the node. |
| `events?` | `Partial<NodeEvents>` | Node-specific event listeners. |
| `domAttributes?` | `Record<string, any>` | Custom DOM attributes. |
