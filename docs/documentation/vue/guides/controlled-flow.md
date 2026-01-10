# Controlled Flow (Advanced State Management)

Source: https://vueflow.dev/guide/controlled-flow.html

By default, Vue Flow handles state changes (dragging, selecting, deleting) automatically. For complex applications, you can take full control of these changes to implement validation, undo/redo, or custom synchronization logic.

## The `applyDefault` Option

Setting `:apply-default="false"` disables automatic state updates, requiring you to handle them manually.

```vue
<template>
  <VueFlow
    :nodes="nodes"
    :edges="edges"
    :apply-default="false"
    @nodes-change="onNodesChange"
  />
</template>
```

## Understanding Changes

A **Change** is an object describing an interaction. Types include:
- `add`: Node/edge added.
- `remove`: Node/edge removed.
- `select`: Selection state toggled.
- `position`: Node moved.
- `dimensions`: Node resized or initial size calculated.

## Manual Application

Use `applyNodeChanges` and `applyEdgeChanges` from `useVueFlow` to update the state after processing.

```javascript
const { applyNodeChanges, applyEdgeChanges } = useVueFlow()

const onNodesChange = (changes) => {
  // You can filter, validate, or transform changes here
  applyNodeChanges(changes)
}
```

## Validation Example (Confirm Delete)

```javascript
const onNodesChange = async (changes) => {
  const nextChanges = []
  for (const change of changes) {
    if (change.type === 'remove') {
      const confirmed = await showConfirmModal('Delete this node?')
      if (confirmed) nextChanges.push(change)
    } else {
      nextChanges.push(change)
    }
  }
  applyNodeChanges(nextChanges)
}
```

## V-Model Synchronization

Use `v-model:nodes` and `v-model:edges` to keep your local reactive state perfectly synced with Vue Flow's internal state.

```vue
<template>
  <VueFlow v-model:nodes="nodes" v-model:edges="edges" />
</template>
```
> [!NOTE]
> This is highly recommended when using `updateNode` or other programmatic actions to ensure your local `ref` reflects the changes immediately.
