# FlowEvents Interface

Source: https://vueflow.dev/typedocs/interfaces/FlowEvents.html

`FlowEvents` defines the event handlers available on the `VueFlow` component.

## Event Handlers

### Node Events
- `nodeClick`: Emitted when a node is clicked.
- `nodeDoubleClick`: Emitted when a node is double-clicked.
- `nodeContextMenu`: Emitted when a node's context menu is requested.
- `nodeMouseEnter`: Emitted when the mouse enters a node.
- `nodeMouseLeave`: Emitted when the mouse leaves a node.
- `nodeMouseMove`: Emitted when the mouse moves over a node.
- `nodeDragStart`: Emitted when a node drag starts.
- `nodeDrag`: Emitted when a node is being dragged.
- `nodeDragStop`: Emitted when a node drag stops.

### Edge Events
- `edgeClick`: Emitted when an edge is clicked.
- `edgeDoubleClick`: Emitted when an edge is double-clicked.
- `edgeContextMenu`: Emitted when an edge's context menu is requested.
- `edgeMouseEnter`: Emitted when the mouse enters an edge.
- `edgeMouseLeave`: Emitted when the mouse leaves an edge.
- `edgeMouseMove`: Emitted when the mouse moves over an edge.
- `edgeUpdateStart`: Emitted when an edge update starts.
- `edgeUpdate`: Emitted when an edge is being updated.
- `edgeUpdateEnd`: Emitted when an edge update ends.

### Connection Events
- `connectStart`: Emitted when a connection starts.
- `connect`: Emitted when a connection is established.
- `connectEnd`: Emitted when a connection attempt ends.
- `clickConnectStart`: Emitted when a connection starts via click.
- `clickConnectEnd`: Emitted when a connection effort ends via click.

### Pane Events
- `paneClick`: Emitted when the pane is clicked.
- `paneContextMenu`: Emitted when the pane's context menu is requested.
- `paneMouseEnter`: Emitted when the mouse enters the pane.
- `paneMouseLeave`: Emitted when the mouse leaves the pane.
- `paneMouseMove`: Emitted when the mouse moves over the pane.
- `paneReady`: Emitted when the pane is ready.
- `paneScroll`: Emitted when the pane is scrolled.

### Selection Events
- `selectionStart`: Emitted when selection starts.
- `selectionEnd`: Emitted when selection ends.
- `selectionDragStart`: Emitted when selection drag starts.
- `selectionDrag`: Emitted when selection is being dragged.
- `selectionDragStop`: Emitted when selection drag stops.
- `selectionContextMenu`: Emitted when selection context menu is requested.

### Viewport Events
- `moveStart`: Emitted when the viewport starts moving.
- `move`: Emitted when the viewport is moving.
- `moveEnd`: Emitted when the viewport stops moving.
- `viewportChangeStart`: Emitted when viewport change starts.
- `viewportChange`: Emitted when viewport is changing.
- `viewportChangeEnd`: Emitted when viewport change ends.

### Change Events
- `nodesChange`: Emitted when nodes change.
- `edgesChange`: Emitted when edges change.
- `nodesInitialized`: Emitted when nodes are initialized.

### Minimap Events
- `miniMapNodeClick`: Emitted when a minimap node is clicked.
- `miniMapNodeDoubleClick`: Emitted when a minimap node is double-clicked.
- `miniMapNodeMouseEnter`: Emitted when the mouse enters a minimap node.
- `miniMapNodeMouseLeave`: Emitted when the mouse leaves a minimap node.
- `miniMapNodeMouseMove`: Emitted when the mouse moves over a minimap node.

### Other Events
- `error`: Emitted when an error occurs.
- `init`: Emitted when Vue Flow is initialized.
- `updateNodeInternals`: Emitted when node internals should be updated.
