<template>
  <div class="todo-view">
    <div class="coming-soon">
      <h1>Todo View</h1>
      <p>This view is currently under development.</p>
      <router-link to="/tasks" class="btn-primary">Go to Tasks instead</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
// Placeholder component for future Todo view implementation
</script>

<style scoped>
.todo-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-4);
  background: var(--app-background-gradient);
}

.coming-soon {
  text-align: center;
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-width: 400px;
  width: 100%;
}

.coming-soon h1 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.coming-soon p {
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}

.btn-primary {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  background: var(--brand-primary);
  color: white;
  text-decoration: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  transition: opacity var(--duration-fast);
}

.btn-primary:hover {
  opacity: 0.9;
}
</style>
