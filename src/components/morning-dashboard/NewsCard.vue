<script setup lang="ts">
defineProps<{
  title: string
  url: string
  points: number
  domain: string
}>()
</script>

<template>
  <div class="news-card">
    <a
      class="news-title"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
    >{{ title }}</a>
    <div class="news-meta">
      <span class="news-domain">{{ domain }}</span>
      <span class="news-points">{{ points }} pts</span>
    </div>
  </div>
</template>

<style scoped>
.news-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  transition: background var(--duration-normal) var(--ease-out);
}

.news-card:hover {
  background: rgba(255, 255, 255, 0.04);
}

.news-title {
  font-size: 0.8125rem;
  color: var(--text-primary);
  text-decoration: none;
  line-height: 1.4;
  transition: color var(--duration-normal) var(--ease-out);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-title:hover {
  color: var(--brand-primary);
  text-decoration: underline;
}

.news-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.news-domain {
  font-size: 0.7rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.news-points {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}
</style>
