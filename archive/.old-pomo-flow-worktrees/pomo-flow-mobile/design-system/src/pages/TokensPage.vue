<template>
  <div class="page">
    <h1 class="page-title">Design Tokens</h1>
    <p class="page-description">Click any token to copy its CSS variable name</p>

    <section class="section">
      <h2 class="section-title">Colors</h2>

      <div class="subsection">
        <h3 class="subsection-title">Brand Colors</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--brand-primary')">
            <div class="color-swatch" style="background: var(--brand-primary);"></div>
            <div class="token-name">--brand-primary</div>
            <div class="token-value">hsl(217, 91%, 60%)</div>
          </div>
          <div class="token-card" @click="copyToken('--brand-hover')">
            <div class="color-swatch" style="background: var(--brand-hover);"></div>
            <div class="token-name">--brand-hover</div>
            <div class="token-value">hsl(217, 91%, 65%)</div>
          </div>
          <div class="token-card" @click="copyToken('--brand-active')">
            <div class="color-swatch" style="background: var(--brand-active);"></div>
            <div class="token-name">--brand-active</div>
            <div class="token-value">hsl(217, 91%, 55%)</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Pomodoro States</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--color-work')">
            <div class="color-swatch" style="background: var(--color-work);"></div>
            <div class="token-name">--color-work</div>
            <div class="token-value">#10b981</div>
          </div>
          <div class="token-card" @click="copyToken('--color-break')">
            <div class="color-swatch" style="background: var(--color-break);"></div>
            <div class="token-name">--color-break</div>
            <div class="token-value">#f59e0b</div>
          </div>
          <div class="token-card" @click="copyToken('--color-focus')">
            <div class="color-swatch" style="background: var(--color-focus);"></div>
            <div class="token-name">--color-focus</div>
            <div class="token-value">#8b5cf6</div>
          </div>
          <div class="token-card" @click="copyToken('--color-navigation')">
            <div class="color-swatch" style="background: var(--color-navigation);"></div>
            <div class="token-name">--color-navigation</div>
            <div class="token-value">#3b82f6</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Priority Colors</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--color-priority-high')">
            <div class="color-swatch" style="background: var(--color-priority-high);"></div>
            <div class="token-name">--color-priority-high</div>
            <div class="token-value">#ef4444</div>
          </div>
          <div class="token-card" @click="copyToken('--color-priority-medium')">
            <div class="color-swatch" style="background: var(--color-priority-medium);"></div>
            <div class="token-name">--color-priority-medium</div>
            <div class="token-value">#f59e0b</div>
          </div>
          <div class="token-card" @click="copyToken('--color-priority-low')">
            <div class="color-swatch" style="background: var(--color-priority-low);"></div>
            <div class="token-name">--color-priority-low</div>
            <div class="token-value">#3b82f6</div>
          </div>
          <div class="token-card" @click="copyToken('--priority-high-bg')">
            <div class="color-swatch" style="background: var(--priority-high-bg);"></div>
            <div class="token-name">--priority-high-bg</div>
            <div class="token-value">rgba(239, 68, 68, 0.3)</div>
          </div>
          <div class="token-card" @click="copyToken('--priority-medium-bg')">
            <div class="color-swatch" style="background: var(--priority-medium-bg);"></div>
            <div class="token-name">--priority-medium-bg</div>
            <div class="token-value">rgba(16, 185, 129, 0.3)</div>
          </div>
          <div class="token-card" @click="copyToken('--priority-low-bg')">
            <div class="color-swatch" style="background: var(--priority-low-bg);"></div>
            <div class="token-name">--priority-low-bg</div>
            <div class="token-value">rgba(59, 130, 246, 0.3)</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Status Colors</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--color-success')">
            <div class="color-swatch" style="background: var(--color-success);"></div>
            <div class="token-name">--color-success</div>
          </div>
          <div class="token-card" @click="copyToken('--color-warning')">
            <div class="color-swatch" style="background: var(--color-warning);"></div>
            <div class="token-name">--color-warning</div>
          </div>
          <div class="token-card" @click="copyToken('--color-danger')">
            <div class="color-swatch" style="background: var(--color-danger);"></div>
            <div class="token-name">--color-danger</div>
          </div>
          <div class="token-card" @click="copyToken('--color-info')">
            <div class="color-swatch" style="background: var(--color-info);"></div>
            <div class="token-name">--color-info</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Surface Colors</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--surface-primary')">
            <div class="color-swatch" style="background: var(--surface-primary); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--surface-primary</div>
          </div>
          <div class="token-card" @click="copyToken('--surface-secondary')">
            <div class="color-swatch" style="background: var(--surface-secondary); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--surface-secondary</div>
          </div>
          <div class="token-card" @click="copyToken('--surface-tertiary')">
            <div class="color-swatch" style="background: var(--surface-tertiary); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--surface-tertiary</div>
          </div>
          <div class="token-card" @click="copyToken('--surface-elevated')">
            <div class="color-swatch" style="background: var(--surface-elevated); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--surface-elevated</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Text Colors</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--text-primary')">
            <div class="color-swatch" style="background: var(--text-primary); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--text-primary</div>
          </div>
          <div class="token-card" @click="copyToken('--text-secondary')">
            <div class="color-swatch" style="background: var(--text-secondary); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--text-secondary</div>
          </div>
          <div class="token-card" @click="copyToken('--text-tertiary')">
            <div class="color-swatch" style="background: var(--text-tertiary); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--text-tertiary</div>
          </div>
          <div class="token-card" @click="copyToken('--text-muted')">
            <div class="color-swatch" style="background: var(--text-muted); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--text-muted</div>
          </div>
          <div class="token-card" @click="copyToken('--text-subtle')">
            <div class="color-swatch" style="background: var(--text-subtle); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--text-subtle</div>
          </div>
          <div class="token-card" @click="copyToken('--text-disabled')">
            <div class="color-swatch" style="background: var(--text-disabled); border: 1px solid var(--border-primary);"></div>
            <div class="token-name">--text-disabled</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Border Colors</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--border-subtle')">
            <div class="border-swatch" style="border: 2px solid var(--border-subtle);"></div>
            <div class="token-name">--border-subtle</div>
          </div>
          <div class="token-card" @click="copyToken('--border-medium')">
            <div class="border-swatch" style="border: 2px solid var(--border-medium);"></div>
            <div class="token-name">--border-medium</div>
          </div>
          <div class="token-card" @click="copyToken('--border-strong')">
            <div class="border-swatch" style="border: 2px solid var(--border-strong);"></div>
            <div class="token-name">--border-strong</div>
          </div>
          <div class="token-card" @click="copyToken('--border-primary')">
            <div class="border-swatch" style="border: 2px solid var(--border-primary);"></div>
            <div class="token-name">--border-primary</div>
          </div>
          <div class="token-card" @click="copyToken('--border-hover')">
            <div class="border-swatch" style="border: 2px solid var(--border-hover);"></div>
            <div class="token-name">--border-hover</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Glass Effects</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--glass-bg-light')">
            <div class="glass-swatch" style="background: var(--glass-bg-light); backdrop-filter: blur(10px);"></div>
            <div class="token-name">--glass-bg-light</div>
          </div>
          <div class="token-card" @click="copyToken('--glass-bg-medium')">
            <div class="glass-swatch" style="background: var(--glass-bg-medium); backdrop-filter: blur(10px);"></div>
            <div class="token-name">--glass-bg-medium</div>
          </div>
          <div class="token-card" @click="copyToken('--glass-bg-heavy')">
            <div class="glass-swatch" style="background: var(--glass-bg-heavy); backdrop-filter: blur(10px);"></div>
            <div class="token-name">--glass-bg-heavy</div>
          </div>
          <div class="token-card" @click="copyToken('--glass-border')">
            <div class="border-swatch" style="border: 2px solid var(--glass-border);"></div>
            <div class="token-name">--glass-border</div>
          </div>
          <div class="token-card" @click="copyToken('--glass-border-hover')">
            <div class="border-swatch" style="border: 2px solid var(--glass-border-hover);"></div>
            <div class="token-name">--glass-border-hover</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Interactive States</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--state-active-border')">
            <div class="border-swatch" style="border: 2px solid var(--state-active-border);"></div>
            <div class="token-name">--state-active-border</div>
          </div>
          <div class="token-card" @click="copyToken('--state-active-bg')">
            <div class="color-swatch" style="background: var(--state-active-bg);"></div>
            <div class="token-name">--state-active-bg</div>
          </div>
          <div class="token-card" @click="copyToken('--state-hover-border')">
            <div class="border-swatch" style="border: 2px solid var(--state-hover-border);"></div>
            <div class="token-name">--state-hover-border</div>
          </div>
          <div class="token-card" @click="copyToken('--state-hover-bg')">
            <div class="color-swatch" style="background: var(--state-hover-bg);"></div>
            <div class="token-name">--state-hover-bg</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Spacing</h2>
      <p class="subsection-description">8px grid system (4px base unit)</p>
      <div class="token-grid">
        <div class="token-card" @click="copyToken('--space-0')">
          <div class="spacing-bar" style="width: var(--space-0);"></div>
          <div class="token-name">--space-0</div>
          <div class="token-value">0</div>
        </div>
        <div class="token-card" @click="copyToken('--space-1')">
          <div class="spacing-bar" style="width: var(--space-1);"></div>
          <div class="token-name">--space-1</div>
          <div class="token-value">4px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-2')">
          <div class="spacing-bar" style="width: var(--space-2);"></div>
          <div class="token-name">--space-2</div>
          <div class="token-value">8px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-3')">
          <div class="spacing-bar" style="width: var(--space-3);"></div>
          <div class="token-name">--space-3</div>
          <div class="token-value">12px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-4')">
          <div class="spacing-bar" style="width: var(--space-4);"></div>
          <div class="token-name">--space-4</div>
          <div class="token-value">16px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-5')">
          <div class="spacing-bar" style="width: var(--space-5);"></div>
          <div class="token-name">--space-5</div>
          <div class="token-value">20px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-6')">
          <div class="spacing-bar" style="width: var(--space-6);"></div>
          <div class="token-name">--space-6</div>
          <div class="token-value">24px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-8')">
          <div class="spacing-bar" style="width: var(--space-8);"></div>
          <div class="token-name">--space-8</div>
          <div class="token-value">32px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-10')">
          <div class="spacing-bar" style="width: var(--space-10);"></div>
          <div class="token-name">--space-10</div>
          <div class="token-value">40px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-12')">
          <div class="spacing-bar" style="width: var(--space-12);"></div>
          <div class="token-name">--space-12</div>
          <div class="token-value">48px</div>
        </div>
        <div class="token-card" @click="copyToken('--space-16')">
          <div class="spacing-bar" style="width: var(--space-16);"></div>
          <div class="token-name">--space-16</div>
          <div class="token-value">64px</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Typography</h2>

      <div class="subsection">
        <h3 class="subsection-title">Font Families</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--font-primary')">
            <div class="font-sample" style="font-family: var(--font-primary);">Open Sans</div>
            <div class="token-name">--font-primary</div>
          </div>
          <div class="token-card" @click="copyToken('--font-mono')">
            <div class="font-sample" style="font-family: var(--font-mono);">SF Mono</div>
            <div class="token-name">--font-mono</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Type Scale (1.25 ratio)</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--text-xs')">
            <div class="type-sample" style="font-size: var(--text-xs);">Text XS</div>
            <div class="token-name">--text-xs</div>
            <div class="token-value">12px</div>
          </div>
          <div class="token-card" @click="copyToken('--text-sm')">
            <div class="type-sample" style="font-size: var(--text-sm);">Text SM</div>
            <div class="token-name">--text-sm</div>
            <div class="token-value">14px</div>
          </div>
          <div class="token-card" @click="copyToken('--text-base')">
            <div class="type-sample" style="font-size: var(--text-base);">Text Base</div>
            <div class="token-name">--text-base</div>
            <div class="token-value">16px</div>
          </div>
          <div class="token-card" @click="copyToken('--text-lg')">
            <div class="type-sample" style="font-size: var(--text-lg);">Text LG</div>
            <div class="token-name">--text-lg</div>
            <div class="token-value">18px</div>
          </div>
          <div class="token-card" @click="copyToken('--text-xl')">
            <div class="type-sample" style="font-size: var(--text-xl);">Text XL</div>
            <div class="token-name">--text-xl</div>
            <div class="token-value">20px</div>
          </div>
          <div class="token-card" @click="copyToken('--text-2xl')">
            <div class="type-sample" style="font-size: var(--text-2xl);">Text 2XL</div>
            <div class="token-name">--text-2xl</div>
            <div class="token-value">24px</div>
          </div>
          <div class="token-card" @click="copyToken('--text-3xl')">
            <div class="type-sample" style="font-size: var(--text-3xl);">Text 3XL</div>
            <div class="token-name">--text-3xl</div>
            <div class="token-value">30px</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Font Weights</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--font-normal')">
            <div class="weight-sample" style="font-weight: var(--font-normal);">Normal 400</div>
            <div class="token-name">--font-normal</div>
          </div>
          <div class="token-card" @click="copyToken('--font-medium')">
            <div class="weight-sample" style="font-weight: var(--font-medium);">Medium 500</div>
            <div class="token-name">--font-medium</div>
          </div>
          <div class="token-card" @click="copyToken('--font-semibold')">
            <div class="weight-sample" style="font-weight: var(--font-semibold);">Semibold 600</div>
            <div class="token-name">--font-semibold</div>
          </div>
          <div class="token-card" @click="copyToken('--font-bold')">
            <div class="weight-sample" style="font-weight: var(--font-bold);">Bold 700</div>
            <div class="token-name">--font-bold</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Line Heights</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--leading-none')">
            <div class="token-name">--leading-none</div>
            <div class="token-value">1</div>
          </div>
          <div class="token-card" @click="copyToken('--leading-tight')">
            <div class="token-name">--leading-tight</div>
            <div class="token-value">1.25</div>
          </div>
          <div class="token-card" @click="copyToken('--leading-normal')">
            <div class="token-name">--leading-normal</div>
            <div class="token-value">1.5</div>
          </div>
          <div class="token-card" @click="copyToken('--leading-relaxed')">
            <div class="token-name">--leading-relaxed</div>
            <div class="token-value">1.75</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Border Radius</h2>
      <div class="token-grid">
        <div class="token-card" @click="copyToken('--radius-sm')">
          <div class="radius-box" style="border-radius: var(--radius-sm);"></div>
          <div class="token-name">--radius-sm</div>
          <div class="token-value">4px</div>
        </div>
        <div class="token-card" @click="copyToken('--radius-md')">
          <div class="radius-box" style="border-radius: var(--radius-md);"></div>
          <div class="token-name">--radius-md</div>
          <div class="token-value">6px</div>
        </div>
        <div class="token-card" @click="copyToken('--radius-lg')">
          <div class="radius-box" style="border-radius: var(--radius-lg);"></div>
          <div class="token-name">--radius-lg</div>
          <div class="token-value">8px</div>
        </div>
        <div class="token-card" @click="copyToken('--radius-xl')">
          <div class="radius-box" style="border-radius: var(--radius-xl);"></div>
          <div class="token-name">--radius-xl</div>
          <div class="token-value">12px</div>
        </div>
        <div class="token-card" @click="copyToken('--radius-2xl')">
          <div class="radius-box" style="border-radius: var(--radius-2xl);"></div>
          <div class="token-name">--radius-2xl</div>
          <div class="token-value">16px</div>
        </div>
        <div class="token-card" @click="copyToken('--radius-full')">
          <div class="radius-box" style="border-radius: var(--radius-full);"></div>
          <div class="token-name">--radius-full</div>
          <div class="token-value">9999px</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Shadows</h2>
      <div class="token-grid">
        <div class="token-card" @click="copyToken('--shadow-xs')">
          <div class="shadow-box" style="box-shadow: var(--shadow-xs);"></div>
          <div class="token-name">--shadow-xs</div>
        </div>
        <div class="token-card" @click="copyToken('--shadow-sm')">
          <div class="shadow-box" style="box-shadow: var(--shadow-sm);"></div>
          <div class="token-name">--shadow-sm</div>
        </div>
        <div class="token-card" @click="copyToken('--shadow-md')">
          <div class="shadow-box" style="box-shadow: var(--shadow-md);"></div>
          <div class="token-name">--shadow-md</div>
        </div>
        <div class="token-card" @click="copyToken('--shadow-lg')">
          <div class="shadow-box" style="box-shadow: var(--shadow-lg);"></div>
          <div class="token-name">--shadow-lg</div>
        </div>
        <div class="token-card" @click="copyToken('--shadow-xl')">
          <div class="shadow-box" style="box-shadow: var(--shadow-xl);"></div>
          <div class="token-name">--shadow-xl</div>
        </div>
        <div class="token-card" @click="copyToken('--shadow-2xl')">
          <div class="shadow-box" style="box-shadow: var(--shadow-2xl);"></div>
          <div class="token-name">--shadow-2xl</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Animation</h2>

      <div class="subsection">
        <h3 class="subsection-title">Easing Curves</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--spring-smooth')">
            <div class="token-name">--spring-smooth</div>
            <div class="token-value">cubic-bezier(0.4, 0, 0.2, 1)</div>
          </div>
          <div class="token-card" @click="copyToken('--spring-bounce')">
            <div class="token-name">--spring-bounce</div>
            <div class="token-value">cubic-bezier(0.68, -0.55, 0.265, 1.55)</div>
          </div>
          <div class="token-card" @click="copyToken('--spring-swift')">
            <div class="token-name">--spring-swift</div>
            <div class="token-value">cubic-bezier(0.25, 0.46, 0.45, 0.94)</div>
          </div>
          <div class="token-card" @click="copyToken('--spring-gentle')">
            <div class="token-name">--spring-gentle</div>
            <div class="token-value">cubic-bezier(0.16, 1, 0.3, 1)</div>
          </div>
        </div>
      </div>

      <div class="subsection">
        <h3 class="subsection-title">Duration Scale</h3>
        <div class="token-grid">
          <div class="token-card" @click="copyToken('--duration-instant')">
            <div class="token-name">--duration-instant</div>
            <div class="token-value">50ms</div>
          </div>
          <div class="token-card" @click="copyToken('--duration-fast')">
            <div class="token-name">--duration-fast</div>
            <div class="token-value">150ms</div>
          </div>
          <div class="token-card" @click="copyToken('--duration-normal')">
            <div class="token-name">--duration-normal</div>
            <div class="token-value">200ms</div>
          </div>
          <div class="token-card" @click="copyToken('--duration-slow')">
            <div class="token-name">--duration-slow</div>
            <div class="token-value">300ms</div>
          </div>
          <div class="token-card" @click="copyToken('--duration-slower')">
            <div class="token-name">--duration-slower</div>
            <div class="token-value">500ms</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Copied notification -->
    <div v-if="showCopied" class="copied-notification">
      ✓ Copied: {{ copiedToken }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const showCopied = ref(false)
const copiedToken = ref('')

const copyToken = async (token: string) => {
  try {
    await navigator.clipboard.writeText(token)
    copiedToken.value = token
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.page {
  max-width: 1400px;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.page-description {
  font-size: var(--text-base);
  color: var(--text-muted);
  margin-bottom: var(--space-8);
}

.section {
  margin-bottom: var(--space-12);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-primary);
}

.subsection {
  margin-bottom: var(--space-8);
}

.subsection-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.token-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

.token-card {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.token-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow);
}

.color-swatch {
  width: 100%;
  height: 80px;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.spacing-bar {
  height: 32px;
  background: var(--brand-primary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-3);
}

.token-name {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--brand-primary);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-1);
}

.token-value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.subsection-description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-4);
  margin-top: calc(var(--space-4) * -1);
}

.border-swatch {
  width: 100%;
  height: 80px;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  background: var(--surface-secondary);
}

.glass-swatch {
  width: 100%;
  height: 80px;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  border: 1px solid var(--glass-border);
  position: relative;
}

.glass-swatch::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255, 255, 255, 0.05) 10px,
    rgba(255, 255, 255, 0.05) 20px
  );
  border-radius: var(--radius-md);
  pointer-events: none;
}

.radius-box {
  width: 100%;
  height: 80px;
  background: var(--brand-primary);
  margin-bottom: var(--space-3);
}

.shadow-box {
  width: 100%;
  height: 80px;
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.font-sample {
  font-size: var(--text-2xl);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  text-align: center;
}

.type-sample {
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  text-align: center;
  font-weight: var(--font-medium);
}

.weight-sample {
  font-size: var(--text-lg);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  text-align: center;
}

.copied-notification {
  position: fixed;
  bottom: var(--space-8);
  right: var(--space-8);
  background: var(--color-work);
  color: white;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  font-weight: var(--font-semibold);
  animation: slideIn 0.3s ease;
  z-index: 9999;
}

@keyframes slideIn {
  from {
    transform: translateY(100px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
