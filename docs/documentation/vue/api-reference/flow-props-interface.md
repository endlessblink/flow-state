# FlowProps Interface

Source: https://vueflow.dev/typedocs/interfaces/FlowProps.html

`FlowProps` defines the props available for the `VueFlow` component.

## Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `nodes?` | `Node[]` | Array of initial nodes. |
| `edges?` | `Edge[]` | Array of initial edges. |
| `modelValue?` | `Elements` | V-model for nodes and edges. |
| `nodeTypes?` | `Record<string, Component>` | Custom node type definitions. |
| `edgeTypes?` | `Record<string, Component>` | Custom edge type definitions. |
| `id?` | `string` | Unique ID for the flow instance. |
| `fitViewOnInit?` | `boolean` | Fit view on initialization. |
| `nodesDraggable?` | `boolean` | Global draggability for nodes. |
| `nodesConnectable?` | `boolean` | Global connectability for nodes. |
| `nodesFocusable?` | `boolean` | Global focusability for nodes. |
| `edgesFocusable?` | `boolean` | Global focusability for edges. |
| `edgesUpdatable?` | `boolean \| 'all'` | Global updatability for edges. |
| `elementsSelectable?` | `boolean` | Global selectability for elements. |
| `snapToGrid?` | `boolean` | Enable snapping to grid. |
| `snapGrid?` | `[number, number]` | Grid snapping dimensions. |
| `minZoom?` | `number` | Minimum zoom level. |
| `maxZoom?` | `number` | Maximum zoom level. |
| `defaultViewport?` | `Viewport` | Initial viewport settings. |
| `translateExtent?` | `CoordinateExtent` | Movement boundaries for the pane. |
| `nodeExtent?` | `CoordinateExtent` | Movement boundaries for nodes. |
| `zoomOnScroll?` | `boolean` | Enable zoom on scroll. |
| `zoomOnDoubleClick?` | `boolean` | Enable zoom on double click. |
| `zoomOnPinch?` | `boolean` | Enable zoom on pinch. |
| `panOnScroll?` | `boolean` | Enable pan on scroll. |
| `panOnDrag?` | `boolean \| number[]` | Enable pan on drag. |
| `panOnScrollMode?` | `PanOnScrollMode` | Panning behavior on scroll. |
| `panOnScrollSpeed?` | `number` | Panning speed on scroll. |
| `preventScrolling?` | `boolean` | Prevent default scroll behavior. |
| `selectionKeyCode?` | `string \| boolean` | Key code for selection box. |
| `multiSelectionKeyCode?` | `string \| boolean` | Key code for multi-selection. |
| `deleteKeyCode?` | `string \| boolean` | Key code for deleting elements. |
| `panActivationKeyCode?` | `string \| boolean` | Key code for activating pan. |
| `selectionMode?` | `SelectionMode` | Behavior of the selection box. |
| `selectNodesOnDrag?` | `boolean` | Select nodes while dragging. |
| `autoConnect?` | `boolean \| Partial<Connection>` | Automatically connect handles. |
| `connectionLineStyle?` | `CSSProperties` | Style for the connection line. |
| `connectionLineType?` | `ConnectionLineType` | Type of connection line (e.g., Bezier). |
| `connectionLineOptions?` | `ConnectionLineOptions` | Options for the connection line. |
| `connectionMode?` | `ConnectionMode` | Strict or Loose connection mode. |
| `connectionRadius?` | `number` | Radius for handle snapping. |
| `isValidConnection?` | `ValidConnectionFunc` | Global validation for connections. |
| `elevateNodesOnSelect?` | `boolean` | Bring nodes to front on selection. |
| `elevateEdgesOnSelect?` | `boolean` | Bring edges to front on selection. |
| `defaultMarkerColor?` | `string` | Default color for edge markers. |
| `defaultEdgeOptions?` | `DefaultEdgeOptions` | Default options for all edges. |
| `onlyRenderVisibleElements?` | `boolean` | Optimization: only render elements in viewport. |
| `autoPanOnNodeDrag?` | `boolean` | Enable auto-pan when dragging node to edge. |
| `autoPanOnConnect?` | `boolean` | Enable auto-pan when connecting handles. |
| `autoPanSpeed?` | `number` | Speed of auto-panning. |
| `applyDefault?` | `boolean` | Whether to apply default behaviors. |
| `autoConnect?` | `boolean \| Connection` | Auto-connect logic. |
| `edgeUpdaterRadius?` | `number` | Radius for updating edge handles. |
| `noDragClassName?` | `string` | Class to prevent dragging. |
| `noWheelClassName?` | `string` | Class to prevent scroll-zoom. |
| `noPanClassName?` | `string` | Class to prevent panning. |
| `paneClickDistance?` | `number` | Threshold for pane click detection. |
| `disableKeyboardA11y?` | `boolean` | Disable keyboard accessibility. |
| `id?` | `string` | Flow ID. |
| `nodeDragThreshold?` | `number` | Threshold for node drag start. |
| `zoomActivationKeyCode?` | `string \| boolean` | Key to activate zoom. |
| `modelValue?` | `Elements` | Model value. |
| `nodes?` | `Node[]` | Nodes prop. |
| `edges?` | `Edge[]` | Edges prop. |
| `nodeTypes?` | `NodeTypes` | Node types prop. |
| `edgeTypes?` | `EdgeTypes` | Edge types prop. |
| `maxZoom?` | `number` | Max zoom prop. |
| `minZoom?` | `number` | Min zoom prop. |
