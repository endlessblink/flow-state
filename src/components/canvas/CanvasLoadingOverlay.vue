<template>
  <div class="canvas-loading-overlay" role="status" aria-live="polite">
    <div class="loading-atmosphere" aria-hidden="true">
      <span class="loading-grid" />
      <span class="loading-glow loading-glow-one" />
      <span class="loading-glow loading-glow-two" />
    </div>
    <div class="loading-content">
      <div class="loading-orbit" aria-hidden="true">
        <span class="loading-orbit-ring loading-orbit-ring-one" />
        <span class="loading-orbit-ring loading-orbit-ring-two" />
        <span class="loading-orbit-dot loading-orbit-dot-one" />
        <span class="loading-orbit-dot loading-orbit-dot-two" />
        <span class="loading-core"><span /></span>
      </div>
      <div class="loading-copy">
        <span class="loading-eyebrow">FLOWSTATE CANVAS</span>
        <span class="loading-text">{{ message || 'Preparing your workspace' }}</span>
        <span class="loading-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<style scoped>
.canvas-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 42%, rgba(34, 211, 238, 0.1), transparent 24%), linear-gradient(135deg, #0b1020, #15162b 58%, #101827);
  backdrop-filter: blur(18px);
  z-index: 50;
}

.loading-atmosphere,
.loading-grid,
.loading-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.loading-grid {
  opacity: 0.2;
  background-image: radial-gradient(rgba(148, 163, 184, 0.5) 0.7px, transparent 0.7px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse at center, black 10%, transparent 72%);
  animation: grid-drift 12s linear infinite;
}

.loading-glow {
  inset: auto;
  width: 20rem;
  height: 20rem;
  border-radius: 50%;
  filter: blur(46px);
  opacity: 0.15;
}

.loading-glow-one {
  top: 10%;
  left: 14%;
  background: #22d3ee;
  animation: glow-breathe 4s ease-in-out infinite;
}

.loading-glow-two {
  right: 10%;
  bottom: 4%;
  background: #818cf8;
  animation: glow-breathe 4s ease-in-out -2s infinite;
}

.loading-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 1.35rem;
  min-width: 16rem;
  padding: 1.4rem 1.8rem;
  border: 1px solid rgba(125, 211, 252, 0.16);
  border-radius: 1.25rem;
  background: rgba(15, 23, 42, 0.52);
  box-shadow: 0 24px 80px rgba(2, 6, 23, 0.42), inset 0 1px rgba(255, 255, 255, 0.06);
  animation: content-arrive 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.loading-orbit {
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  flex: 0 0 auto;
}

.loading-orbit-ring,
.loading-core {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.loading-orbit-ring {
  border: 1px solid rgba(103, 232, 249, 0.34);
}

.loading-orbit-ring-one { transform: rotate(25deg) scaleY(0.52); animation: orbit-spin 2.8s linear infinite; }
.loading-orbit-ring-two { transform: rotate(-35deg) scaleY(0.52); border-color: rgba(129, 140, 248, 0.4); animation: orbit-spin-reverse 3.6s linear infinite; }

.loading-core {
  inset: 1.25rem;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 35% 30%, #a5f3fc, #0891b2 58%, #164e63);
  box-shadow: 0 0 22px rgba(34, 211, 238, 0.7);
  animation: core-pulse 1.8s ease-in-out infinite;
}

.loading-core span {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: white;
  box-shadow: 0 0 8px white;
}

.loading-orbit-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.38rem;
  height: 0.38rem;
  margin: -0.19rem;
  border-radius: 50%;
  background: #67e8f9;
  box-shadow: 0 0 10px #22d3ee;
}

.loading-orbit-dot-one { animation: dot-orbit-one 2.8s linear infinite; }
.loading-orbit-dot-two { background: #a5b4fc; box-shadow: 0 0 10px #818cf8; animation: dot-orbit-two 3.6s linear infinite; }

.loading-copy {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 9.5rem;
}

.loading-eyebrow {
  color: #67e8f9;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  white-space: nowrap;
}

.loading-text {
  color: rgba(241, 245, 249, 0.92);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
}

.loading-dots {
  display: inline-flex;
  gap: 0.2rem;
  margin-left: 0.15rem;
}

.loading-dots i {
  width: 0.22rem;
  height: 0.22rem;
  border-radius: 50%;
  background: #67e8f9;
  animation: dot-blink 1.2s ease-in-out infinite;
}

.loading-dots i:nth-child(2) { animation-delay: 150ms; }
.loading-dots i:nth-child(3) { animation-delay: 300ms; }

@media (max-width: 520px) {
  .loading-content { flex-direction: column; gap: 0.8rem; }
  .loading-copy { flex-direction: column; gap: 0.3rem; }
}

@keyframes content-arrive { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes grid-drift { to { background-position: 22px 22px; } }
@keyframes glow-breathe { 50% { transform: scale(1.12); opacity: 0.25; } }
@keyframes orbit-spin { to { transform: rotate(385deg) scaleY(0.52); } }
@keyframes orbit-spin-reverse { to { transform: rotate(-395deg) scaleY(0.52); } }
@keyframes core-pulse { 50% { transform: scale(0.86); box-shadow: 0 0 34px rgba(34, 211, 238, 0.9); } }
@keyframes dot-orbit-one { to { transform: rotate(360deg) translateX(2.25rem) rotate(-360deg); } }
@keyframes dot-orbit-two { to { transform: rotate(-360deg) translateX(2.25rem) rotate(360deg); } }
@keyframes dot-blink { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }

@media (prefers-reduced-motion: reduce) {
  .loading-content, .loading-grid, .loading-glow, .loading-orbit-ring, .loading-core, .loading-orbit-dot, .loading-dots i { animation: none; }
}
</style>
