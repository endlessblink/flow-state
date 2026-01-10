# Events in Vue Flow

Source: https://vueflow.dev/guide/vue-flow/events.html

Vue Flow provides multiple ways to listen to events: through component props or via the `useVueFlow` composable.

## Listening via Component Props

You can listen to any event using the `@` directive on the `<VueFlow />` component.

```vue
<template>
  <VueFlow
    @node-click="onNodeClick"
    @connect="onConnect"
    @pane-scroll="onPaneScroll"
  />
</template>

<script setup>
const onNodeClick = ({ event, node }) => {
  console.log('Node clicked:', node.id)
}
</script>
```

## Listening via useVueFlow

The `useVueFlow` composable provides "on" methods for every event.

```javascript
const { onNodeClick, onConnect } = useVueFlow()

onNodeClick(({ event, node }) => {
  console.log('Node clicked:', node.id)
})

onConnect((params) => {
  console.log('Connection established:', params)
})
```

## Event Categories

- **Node Events**: `nodeClick`, `nodeDrag`, `nodeMouseEnter`, etc.
- **Edge Events**: `edgeClick`, `edgeUpdate`, `edgeMouseEnter`, etc.
- **Connection Events**: `connect`, `connectStart`, `connectEnd`.
- **Pane Events**: `paneClick`, `paneScroll`, `paneContextMenu`.
- **Selection Events**: `selectionStart`, `selectionEnd`.
- **Viewport Events**: `move`, `moveStart`, `moveEnd`.
- **Change Events**: `nodesChange`, `edgesChange`.
