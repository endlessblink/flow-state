import type { Meta, StoryObj } from '@storybook/vue3'

const meta = {
  title: '🖥️ Tauri Parity/Glass Effects',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Showcase of glass morphism CSS classes. Toggle Tauri Mode in toolbar to compare Browser (blur) vs WebKitGTK (opaque) rendering. Each card uses a different glass class so you can see how each one responds to the .tauri-app override.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const glassClasses = [
  {
    cls: 'glass',
    label: '.glass',
    description: 'Base glass class — blur + glass-bg-medium, goes opaque in Tauri',
  },
  {
    cls: 'glass-effect',
    label: '.glass-effect',
    description: 'Generic glass effect used on overlays',
  },
  {
    cls: 'glass-card',
    label: '.glass-card',
    description: 'Card-level glass from design-tokens.css (blur-md + shadow-glass)',
  },
  {
    cls: 'glass-surface',
    label: '.glass-surface',
    description: 'Surface variant of glass morphism',
  },
  {
    cls: 'glass-panel',
    label: '.glass-panel',
    description: 'Panel-level glass — sidebar/panel contexts, opaque in Tauri',
  },
  {
    cls: 'glass-overlay',
    label: '.glass-overlay',
    description: 'Overlay glass for modals/dropdowns',
  },
]

export const Default: Story = {
  render: () => ({
    setup() {
      return { glassClasses }
    },
    template: `
      <div style="
        min-height: 100vh;
        padding: var(--space-10);
        background: var(--app-background-gradient, var(--color-base-950));
        position: relative;
        overflow: hidden;
      ">

        <!-- Colourful background blobs so backdrop-filter blur is visible -->
        <div style="
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        ">
          <div style="
            position: absolute;
            top: 10%;
            left: 5%;
            width: 340px;
            height: 340px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(78,205,196,0.35) 0%, transparent 70%);
            filter: blur(40px);
          "></div>
          <div style="
            position: absolute;
            top: 40%;
            right: 8%;
            width: 280px;
            height: 280px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%);
            filter: blur(50px);
          "></div>
          <div style="
            position: absolute;
            bottom: 15%;
            left: 30%;
            width: 320px;
            height: 320px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%);
            filter: blur(45px);
          "></div>
          <div style="
            position: absolute;
            top: 60%;
            left: 55%;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%);
            filter: blur(35px);
          "></div>
        </div>

        <!-- Page heading -->
        <div style="
          position: relative;
          z-index: 1;
          margin-bottom: var(--space-8);
        ">
          <h1 style="
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            color: var(--text-primary);
            margin: 0 0 var(--space-2) 0;
          ">Glass Morphism Classes</h1>
          <p style="
            font-size: var(--text-sm);
            color: var(--text-muted);
            margin: 0;
          ">
            In Browser mode the blobs behind should be visible through each card (backdrop-filter blur).
            In Tauri mode each card becomes fully opaque — matching WebKitGTK behaviour.
          </p>
        </div>

        <!-- Grid of glass class showcases -->
        <div style="
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-6);
        ">
          <div
            v-for="item in glassClasses"
            :key="item.cls"
            :class="item.cls"
            style="
              height: 200px;
              border-radius: var(--radius-lg);
              padding: var(--space-5);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            "
          >
            <div>
              <code style="
                display: inline-block;
                font-family: var(--font-mono, monospace);
                font-size: var(--text-sm);
                color: var(--brand-primary, #4ECDC4);
                font-weight: var(--font-semibold);
                margin-bottom: var(--space-2);
              ">{{ item.label }}</code>
              <p style="
                font-size: var(--text-xs);
                color: var(--text-muted);
                line-height: var(--leading-relaxed);
                margin: 0;
              ">{{ item.description }}</p>
            </div>

            <!-- Visual indicator of blur presence -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
            ">
              <div style="
                width: var(--space-2);
                height: var(--space-2);
                border-radius: 50%;
                background: var(--brand-primary, #4ECDC4);
              "></div>
              <span style="
                font-size: var(--text-xs);
                color: var(--text-tertiary);
              ">backdrop-filter active</span>
            </div>
          </div>
        </div>

        <!-- Side-by-side comparison note -->
        <div style="
          position: relative;
          z-index: 1;
          margin-top: var(--space-10);
          padding: var(--space-5);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          background: var(--glass-bg-soft);
        ">
          <p style="
            font-size: var(--text-sm);
            color: var(--text-secondary);
            margin: 0 0 var(--space-3) 0;
            font-weight: var(--font-semibold);
          ">How to compare:</p>
          <ol style="
            font-size: var(--text-xs);
            color: var(--text-muted);
            margin: 0;
            padding-left: var(--space-5);
            line-height: var(--leading-loose);
          ">
            <li>Open the Storybook toolbar at the top of the page</li>
            <li>Toggle "Tauri Mode" on — cards should become fully opaque purple</li>
            <li>Toggle "Tauri Mode" off — background blobs should bleed through each card</li>
          </ol>
        </div>
      </div>
    `,
  }),
}

export const IndividualClasses: Story = {
  render: () => ({
    setup() {
      return { glassClasses }
    },
    template: `
      <div style="
        min-height: 100vh;
        padding: var(--space-10);
        background: var(--app-background-gradient, var(--color-base-950));
        position: relative;
        overflow: hidden;
      ">
        <!-- Background blobs -->
        <div style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;">
          <div style="
            position: absolute; top: 20%; left: 20%;
            width: 500px; height: 500px; border-radius: 50%;
            background: radial-gradient(circle, rgba(78,205,196,0.4) 0%, transparent 70%);
            filter: blur(60px);
          "></div>
          <div style="
            position: absolute; bottom: 10%; right: 15%;
            width: 400px; height: 400px; border-radius: 50%;
            background: radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 70%);
            filter: blur(50px);
          "></div>
        </div>

        <div style="
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        ">
          <div
            v-for="item in glassClasses"
            :key="item.cls"
            style="display: flex; align-items: stretch; gap: var(--space-4);"
          >
            <!-- Label column -->
            <div style="
              width: 160px;
              flex-shrink: 0;
              display: flex;
              align-items: center;
            ">
              <code style="
                font-family: var(--font-mono, monospace);
                font-size: var(--text-sm);
                color: var(--brand-primary, #4ECDC4);
                font-weight: var(--font-semibold);
              ">{{ item.label }}</code>
            </div>

            <!-- Glass box -->
            <div
              :class="item.cls"
              style="
                flex: 1;
                padding: var(--space-4) var(--space-5);
                border-radius: var(--radius-md);
                display: flex;
                align-items: center;
                min-height: 60px;
              "
            >
              <p style="
                font-size: var(--text-xs);
                color: var(--text-secondary);
                margin: 0;
              ">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
