<script setup lang="ts">
import { Newspaper } from 'lucide-vue-next'
import { useMorningDashboard } from '@/composables/useMorningDashboard'
import NewsCard from './NewsCard.vue'

const { newsItems, isLoadingNews, newsError } = useMorningDashboard()
</script>

<template>
  <div class="morning-news">
    <div class="card-header">
      <Newspaper :size="16" class="header-icon" />
      <h2 class="card-title">Tech News</h2>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoadingNews" class="news-skeleton">
      <div v-for="n in 3" :key="n" class="skeleton-row">
        <div class="skeleton-line skeleton-line--title" />
        <div class="skeleton-line skeleton-line--meta" />
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="newsError" class="news-error">
      <p class="error-text">{{ newsError }}</p>
    </div>

    <!-- News list -->
    <div v-else class="news-list">
      <NewsCard
        v-for="item in newsItems"
        :key="item.url"
        :title="item.title"
        :url="item.url"
        :points="item.points"
        :domain="item.domain"
      />
    </div>
  </div>
</template>

<style scoped>
.morning-news {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Skeleton loading */
.news-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skeleton-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
}

.skeleton-line {
  background: linear-gradient(
    90deg,
    var(--glass-bg-soft) 25%,
    rgba(255, 255, 255, 0.06) 50%,
    var(--glass-bg-soft) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-line--title {
  height: 14px;
  width: 85%;
}

.skeleton-line--meta {
  height: 10px;
  width: 40%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
    background: var(--glass-bg-soft);
  }
}

/* Error state */
.news-error {
  padding: var(--space-3);
}

.error-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}
</style>
