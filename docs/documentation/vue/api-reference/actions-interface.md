# Actions Interface

Source: https://vueflow.dev/typedocs/interfaces/Actions.html

`Actions` provides methods to programmatically control the Vue Flow instance. These are available through the `useVueFlow` store.

## Methods

### Node Management
- `addNodes(nodes)`: Adds one or more nodes.
- `removeNodes(nodes, removeConnectedEdges?)`: Removes one or more nodes.
- `setNodes(nodes)`: Sets the entire nodes array.
- `updateNode(id, nodeUpdate)`: Updates a node's properties.
- `updateNodeData(id, dataUpdate)`: Updates a node's data.
- `updateNodeDimensions(id)`: Force updates a node's dimensions.
- `updateNodeInternals(id)`: Force updates a node's internal state.
- `updateNodePositions(delta)`: Updates positions of multiple nodes.
- `findNode(id)`: Finds a node by ID.

### Edge Management
- `addEdges(edges)`: Adds one or more edges.
- `removeEdges(edges)`: Removes one or more edges.
- `setEdges(edges)`: Sets the entire edges array.
- `updateEdge(id, edgeUpdate)`: Updates an edge's properties.
- `updateEdgeData(id, dataUpdate)`: Updates an edge's data.
- `findEdge(id)`: Finds an edge by ID.
- `applyNodeChanges(changes)`: Applies node changes manually.
- `applyEdgeChanges(changes)`: Applies edge changes manually.

### Elements
- `setElements(elements)`: Sets both nodes and edges.
- `fromObject(obj)`: Loads state from an object.
- `toObject()`: Exports state to an object.

### Finding & Connectivity
- `getConnectedEdges(nodes)`: Gets edges connected to specific nodes.
- `getIncomers(node)`: Gets incomer nodes.
- `getOutgoers(node)`: Gets outgoer nodes.
- `getHandleConnections(params)`: Gets connections for specific handles.

### Viewport Control
- `fitView(options?)`: Fits the view to the current elements.
- `fitBounds(bounds, options?)`: Fits the view to specific bounds.
- `setViewport(viewport, options?)`: Sets the viewport (position and zoom).
- `getViewport()`: Gets current viewport state.
- `getTransform()`: Gets current transformation matrix.
- `setTransform(transform, options?)`: Sets transformation matrix.
- `setCenter(x, y, options?)`: Centers the view on a point.
- `panBy(delta)`: Pans the view by a delta.
- `zoomIn(options?)`: Zooms in.
- `zoomOut(options?)`: Zooms out.
- `zoomTo(zoomLevel, options?)`: Zooms to a specific level.
- `viewportHelper`: Access to internal viewport utilities.

### Coordinate Conversion
- `project(position)`: Converts screen coordinates to flow coordinates.
- `screenToFlowCoordinate(position)`: Converts screen coordinates to flow coordinates.
- `flowToScreenCoordinate(position)`: Converts flow coordinates to screen coordinates.

### Selection
- `addSelectedNodes(nodes)`: Adds nodes to the current selection.
- `addSelectedEdges(edges)`: Adds edges to the current selection.
- `addSelectedElements(elements)`: Adds elements to the current selection.
- `removeSelectedNodes(nodes)`: Removes nodes from the current selection.
- `removeSelectedEdges(edges)`: Removes edges from the current selection.
- `removeSelectedElements(elements)`: Removes elements from the current selection.

### Intersection Detection
- `getIntersectingNodes(node \| rect, partially?)`: finds nodes intersecting with a node or area.
- `isNodeIntersecting(node, area, partially?)`: Checks if a node intersects with an area.

### Store & Lifecycle
- `$reset()`: Resets the store to initial state.
- `$destroy()`: Destroys the store instance.
- `setState(state)`: Sets the entire store state.
- `setInteractive(isInteractive)`: Sets interactivity state globally.
- `setNodeExtent(extent)`: Sets global node movement boundaries.
- `setTranslateExtent(extent)`: Sets global pane movement boundaries.
- `setMinZoom(zoom)`: Sets minimum zoom level.
- `setMaxZoom(zoom)`: Sets maximum zoom level.
- `setPaneClickDistance(distance)`: Sets pane click distance threshold.
- `startConnection(...)`: Programmatically starts a connection.
- `updateConnection(...)`: Programmatically updates a connection.
- `endConnection()`: Programmatically ends a connection.
