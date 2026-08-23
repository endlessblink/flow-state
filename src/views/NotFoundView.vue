<template>
  <main class="not-found-view" aria-labelledby="not-found-title">
    <p class="eyebrow">FlowState</p>
    <h1 id="not-found-title">Page not found</h1>
    <p>The page you opened does not exist or has moved.</p>
    <RouterLink class="return-link" to="/">Return to Canvas</RouterLink>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.not-found-view {
  display: grid;
  min-height: 100vh;
  place-content: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
}

.eyebrow {
  margin: 0;
  color: var(--color-text-secondary, #64748b);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
p {
  margin: 0;
}

.return-link {
  justify-self: center;
  margin-top: 0.5rem;
}
</style>
