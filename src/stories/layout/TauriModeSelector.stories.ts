import type { Meta, StoryObj } from '@storybook/vue3'
import AppLogo from '@/components/base/AppLogo.vue'

// ============================================================================
// INLINE STYLES (Design Token-Based — faithful to TauriModeSelector.vue)
// ============================================================================

const containerStyle = `position: relative; width: 100%; min-height: 600px; background: var(--overlay-component-bg); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl); backdrop-filter: var(--overlay-component-backdrop); -webkit-backdrop-filter: var(--overlay-component-backdrop);`

const contentStyle = `display: flex; flex-direction: column; align-items: center; gap: var(--space-6); padding: var(--space-8); max-width: 600px; width: 90%;`

const logoContainerStyle = `display: flex; flex-direction: column; align-items: center; gap: var(--space-3);`

const logoBoxStyle = `width: var(--space-20); height: var(--space-20); display: flex; align-items: center; justify-content: center; background: var(--glass-bg-heavy); border: var(--overlay-component-border); border-radius: var(--radius-xl);`

const appNameStyle = `font-size: var(--text-2xl); font-weight: 600; color: var(--text-primary); margin: 0;`

const titleStyle = `font-size: var(--text-xl); font-weight: 600; color: var(--text-primary); margin: var(--space-4) 0 0;`

const descriptionStyle = `font-size: var(--text-sm); color: var(--text-secondary); margin: 0;`

const cardsContainerStyle = `display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-4); width: 100%;`

const cardStyle = `display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--glass-bg-heavy); border: 2px solid var(--glass-border); border-radius: var(--radius-lg); cursor: pointer;`

const cardSelectedStyle = `display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--glass-bg-heavy); border: 2px solid var(--brand-primary); border-radius: var(--radius-lg); cursor: pointer;`

const cardHeaderStyle = `display: flex; gap: var(--space-3); align-items: flex-start;`

const cardIconStyle = `font-size: var(--space-8); line-height: 1;`

const cardNameStyle = `font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-1); display: flex; align-items: center; gap: var(--space-2);`

const badgeStyle = `font-size: var(--text-xs); font-weight: 500; color: var(--brand-primary); background: transparent; padding: var(--space-0_5) var(--space-2); border: 1px solid var(--brand-primary); border-radius: var(--radius-full);`

const cardSubtitleStyle = `font-size: var(--text-sm); color: var(--text-secondary); margin: 0;`

const featureListStyle = `list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2);`

const featureItemStyle = `font-size: var(--text-sm); color: var(--text-secondary); padding-left: var(--space-1);`

const continueBtnStyle = `width: 100%; padding: var(--space-3) var(--space-6); background: var(--glass-bg-soft); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-base); font-weight: 600; cursor: pointer; backdrop-filter: blur(8px);`

const helpTextStyle = `font-size: var(--text-xs); color: var(--text-muted); margin: 0; text-align: center;`

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: '🏢 Layout/TauriModeSelector',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Mode selection screen for Tauri desktop app startup.

**Features:**
- Cloud Mode (recommended) vs Local Mode (Docker) selection
- AppLogo + app name header
- Feature comparison cards with selection state
- Glass morphism button pattern with \`var(--brand-primary)\` accent
- Choice persisted to localStorage, changeable in Settings`
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// STORY 1: CLOUD MODE SELECTED (Default)
// ============================================================================

export const Default: Story = {
  name: 'Cloud Mode Selected',
  render: () => ({
    components: { AppLogo },
    template: `
      <div :style="containerStyle">
        <div :style="contentStyle">
          <!-- Logo -->
          <div :style="logoContainerStyle">
            <div :style="logoBoxStyle">
              <AppLogo size="xl" />
            </div>
            <h1 :style="appNameStyle">FlowState</h1>
          </div>

          <!-- Title -->
          <h2 :style="titleStyle">Choose Your Setup</h2>
          <p :style="descriptionStyle">Select how you want to connect to your data</p>

          <!-- Mode Cards -->
          <div :style="cardsContainerStyle">
            <!-- Cloud Mode (Selected) -->
            <div :style="cardSelectedStyle">
              <div :style="cardHeaderStyle">
                <div :style="cardIconStyle">☁️</div>
                <div style="flex: 1;">
                  <h3 :style="cardNameStyle">
                    Cloud Mode
                    <span :style="badgeStyle">Recommended</span>
                  </h3>
                  <p :style="cardSubtitleStyle">Connect to in-theflow.com</p>
                </div>
              </div>
              <ul :style="featureListStyle">
                <li :style="featureItemStyle">✓ Works immediately</li>
                <li :style="featureItemStyle">✓ No setup required</li>
                <li :style="featureItemStyle">✓ Sync across devices</li>
                <li :style="featureItemStyle">✓ Automatic backups</li>
              </ul>
            </div>

            <!-- Local Mode -->
            <div :style="cardStyle">
              <div :style="cardHeaderStyle">
                <div :style="cardIconStyle">🖥️</div>
                <div style="flex: 1;">
                  <h3 :style="cardNameStyle">Local Mode</h3>
                  <p :style="cardSubtitleStyle">Run your own database</p>
                </div>
              </div>
              <ul :style="featureListStyle">
                <li :style="featureItemStyle">✓ Full data control</li>
                <li :style="featureItemStyle">✓ Works offline</li>
                <li :style="featureItemStyle">⚠️ Requires Docker</li>
                <li :style="featureItemStyle">⚠️ Manual setup</li>
              </ul>
            </div>
          </div>

          <!-- Continue Button -->
          <button :style="continueBtnStyle">Continue with Cloud Mode</button>

          <!-- Help -->
          <p :style="helpTextStyle">You can change this later in Settings > Storage</p>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, contentStyle, logoContainerStyle, logoBoxStyle, appNameStyle,
        titleStyle, descriptionStyle, cardsContainerStyle, cardStyle, cardSelectedStyle,
        cardHeaderStyle, cardIconStyle, cardNameStyle, badgeStyle, cardSubtitleStyle,
        featureListStyle, featureItemStyle, continueBtnStyle, helpTextStyle
      }
    }
  })
}

// ============================================================================
// STORY 2: LOCAL MODE SELECTED
// ============================================================================

export const LocalModeSelected: Story = {
  name: 'Local Mode Selected',
  render: () => ({
    components: { AppLogo },
    template: `
      <div :style="containerStyle">
        <div :style="contentStyle">
          <!-- Logo -->
          <div :style="logoContainerStyle">
            <div :style="logoBoxStyle">
              <AppLogo size="xl" />
            </div>
            <h1 :style="appNameStyle">FlowState</h1>
          </div>

          <!-- Title -->
          <h2 :style="titleStyle">Choose Your Setup</h2>
          <p :style="descriptionStyle">Select how you want to connect to your data</p>

          <!-- Mode Cards -->
          <div :style="cardsContainerStyle">
            <!-- Cloud Mode -->
            <div :style="cardStyle">
              <div :style="cardHeaderStyle">
                <div :style="cardIconStyle">☁️</div>
                <div style="flex: 1;">
                  <h3 :style="cardNameStyle">
                    Cloud Mode
                    <span :style="badgeStyle">Recommended</span>
                  </h3>
                  <p :style="cardSubtitleStyle">Connect to in-theflow.com</p>
                </div>
              </div>
              <ul :style="featureListStyle">
                <li :style="featureItemStyle">✓ Works immediately</li>
                <li :style="featureItemStyle">✓ No setup required</li>
                <li :style="featureItemStyle">✓ Sync across devices</li>
                <li :style="featureItemStyle">✓ Automatic backups</li>
              </ul>
            </div>

            <!-- Local Mode (Selected) -->
            <div :style="cardSelectedStyle">
              <div :style="cardHeaderStyle">
                <div :style="cardIconStyle">🖥️</div>
                <div style="flex: 1;">
                  <h3 :style="cardNameStyle">Local Mode</h3>
                  <p :style="cardSubtitleStyle">Run your own database</p>
                </div>
              </div>
              <ul :style="featureListStyle">
                <li :style="featureItemStyle">✓ Full data control</li>
                <li :style="featureItemStyle">✓ Works offline</li>
                <li :style="featureItemStyle">⚠️ Requires Docker</li>
                <li :style="featureItemStyle">⚠️ Manual setup</li>
              </ul>
            </div>
          </div>

          <!-- Continue Button -->
          <button :style="continueBtnStyle">Continue with Local Mode</button>

          <!-- Help -->
          <p :style="helpTextStyle">You can change this later in Settings > Storage</p>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, contentStyle, logoContainerStyle, logoBoxStyle, appNameStyle,
        titleStyle, descriptionStyle, cardsContainerStyle, cardStyle, cardSelectedStyle,
        cardHeaderStyle, cardIconStyle, cardNameStyle, badgeStyle, cardSubtitleStyle,
        featureListStyle, featureItemStyle, continueBtnStyle, helpTextStyle
      }
    }
  })
}
