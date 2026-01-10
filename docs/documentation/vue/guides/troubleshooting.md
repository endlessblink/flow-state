# Troubleshooting & Performance Tips

Source: https://vueflow.dev/guide/troubleshooting.html

Common issues and optimization strategies for Vue Flow applications.

## Performance Optimization

- **Reactive Tracking**: Vue Flow only re-renders elements whose state has changed.
- **Large Graphs**: Use `onlyRenderVisibleElements` prop on `<VueFlow />` to enable virtualization (only rendering nodes in the current viewport).
- **Batching Updates**: Use manual change handling (Controlled Flow) to batch multiple updates into a single `setNodes` call.

## Common Errors

### `MISSING_VIEWPORT_DIMENSIONS`
- **Cause**: Vue Flow container has no height/width.
- **Fix**: Wrap `<VueFlow />` in a `div` with explicit dimensions (`height: 100%` or fixed pixels).

### `NODE_MISSING_PARENT`
- **Cause**: `parentNode` points to an ID that doesn't exist in the current nodes array.
- **Fix**: Ensure the parent node is added to the store **before or at the same time** as the child.

### `NODE_TYPE_MISSING`
- **Cause**: A node has a `type` that isn't registered in `nodeTypes`.
- **Fix**: Check your `nodeTypes` mapping in `useVueFlow` or the `<VueFlow />` component.

## Runtime Error Handling

Vue Flow emits warnings in development mode but stays silent in production. You can listen to errors using the `@error` event:

```vue
<VueFlow @error="(err) => console.error('Vue Flow Error:', err.message)" />
```
