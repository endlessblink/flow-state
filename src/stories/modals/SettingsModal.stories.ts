import type { Meta, StoryObj } from '@storybook/vue3'
import { X, Timer, Palette, Layout, Bot, Database, User, Bell } from 'lucide-vue-next'

// ============================================================================
// INLINE STYLES (Design Token-Based)
// ============================================================================

const overlayStyle = `
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(8px);
`

const modalStyle = `
  background: linear-gradient(135deg, var(--glass-bg-medium) 0%, var(--glass-bg-heavy) 100%);
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow: 0 32px 64px var(--shadow-xl), 0 16px 32px var(--shadow-strong), inset 0 2px 0 var(--glass-border-soft);
  width: 95%;
  max-width: 720px;
  height: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const headerStyle = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--glass-border-strong);
  background: var(--glass-bg-tint);
`

const titleStyle = `
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
`

const closeBtnStyle = `
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
`

const layoutStyle = `
  display: flex;
  flex: 1;
  overflow: hidden;
`

const sidebarStyle = `
  width: 200px;
  background: var(--glass-bg-soft);
  border-right: 1px solid var(--glass-border-strong);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
`

const tabBtnStyle = `
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: left;
`

const tabBtnActiveStyle = `
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: left;
  box-shadow: var(--shadow-sm);
`

const contentStyle = `
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
  background: var(--glass-bg-light);
  position: relative;
`

const sectionHeadingStyle = `
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-4) 0;
`

const settingGroupStyle = `
  margin-bottom: var(--space-6);
`

const settingRowStyle = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
`

const settingLabelStyle = `
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
`

const settingDescStyle = `
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
`

const themeButtonGroupStyle = `
  display: flex;
  gap: var(--space-2);
`

const themeButtonStyle = `
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
`

const themeButtonActiveStyle = `
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
`

const inputStyle = `
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  width: 80px;
  text-align: center;
`

const toggleStyle = `
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
`

const toggleActiveStyle = `
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
`

const toggleKnobStyle = `
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--text-primary);
  border-radius: 50%;
  transition: transform var(--duration-fast) var(--spring-smooth);
`

const toggleKnobActiveStyle = `
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--text-primary);
  border-radius: 50%;
  transition: transform var(--duration-fast) var(--spring-smooth);
  transform: translateX(20px);
`

const actionButtonStyle = `
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  backdrop-filter: blur(8px);
`

const languageOptionStyle = `
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  margin-bottom: var(--space-2);
`

const languageOptionActiveStyle = `
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  margin-bottom: var(--space-2);
`

const radioStyle = `
  width: 16px;
  height: 16px;
  border: 2px solid var(--glass-border);
  border-radius: 50%;
  flex-shrink: 0;
`

const radioActiveStyle = `
  width: 16px;
  height: 16px;
  border: 2px solid var(--brand-primary);
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
`

const radioActiveInnerStyle = `
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: var(--brand-primary);
  border-radius: 50%;
`

const languageTextStyle = `
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
`

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: '🎯 Modals/SettingsModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'SettingsModal provides access to application settings including appearance, timer configuration, workflow preferences, notifications, AI chat, data management, and account settings. Features a glass morphism design with tabbed navigation.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// STORY 1: GENERAL TAB (DEFAULT)
// ============================================================================

export const Default: Story = {
  name: 'General Tab',
  render: () => ({
    components: { X, Timer, Palette, Layout, Bot, Database, User, Bell },
    template: `
      <div :style="overlayStyle">
        <div :style="modalStyle" @click.stop>
          <!-- Header -->
          <header :style="headerStyle">
            <h2 :style="titleStyle">Settings</h2>
            <button :style="closeBtnStyle">
              <X :size="16" />
            </button>
          </header>

          <!-- Layout: Sidebar + Content -->
          <div :style="layoutStyle">
            <!-- Sidebar -->
            <aside :style="sidebarStyle">
              <button :style="tabBtnActiveStyle">
                <Palette :size="18" />
                <span>General</span>
              </button>
              <button :style="tabBtnStyle">
                <Timer :size="18" />
                <span>Timer</span>
              </button>
              <button :style="tabBtnStyle">
                <Layout :size="18" />
                <span>Workflow</span>
              </button>
              <button :style="tabBtnStyle">
                <Bell :size="18" />
                <span>Notifications</span>
              </button>
              <button :style="tabBtnStyle">
                <Bot :size="18" />
                <span>AI & Weekly Plan</span>
              </button>
              <button :style="tabBtnStyle">
                <Database :size="18" />
                <span>Data & Backup</span>
              </button>
              <button :style="tabBtnStyle">
                <User :size="18" />
                <span>Account</span>
              </button>
            </aside>

            <!-- Content -->
            <main :style="contentStyle">
              <!-- Appearance Section -->
              <div :style="settingGroupStyle">
                <h3 :style="sectionHeadingStyle">Appearance</h3>

                <!-- Theme Setting -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Theme</div>
                    <div :style="settingDescStyle">Choose your preferred color scheme</div>
                  </div>
                  <div :style="themeButtonGroupStyle">
                    <button :style="themeButtonActiveStyle">Dark</button>
                    <button :style="themeButtonStyle">Light</button>
                    <button :style="themeButtonStyle">System</button>
                  </div>
                </div>

                <!-- Font Size Setting -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Font Size</div>
                    <div :style="settingDescStyle">Adjust text size throughout the app</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <span style="font-size: var(--text-xs); color: var(--text-muted);">Small</span>
                    <input
                      type="range"
                      min="12"
                      max="18"
                      value="14"
                      style="width: 120px;"
                    />
                    <span style="font-size: var(--text-xs); color: var(--text-muted);">Large</span>
                  </div>
                </div>
              </div>

              <!-- Language Section -->
              <div :style="settingGroupStyle">
                <h3 :style="sectionHeadingStyle">Language</h3>

                <div :style="languageOptionActiveStyle">
                  <div :style="radioActiveStyle">
                    <div :style="radioActiveInnerStyle"></div>
                  </div>
                  <div :style="languageTextStyle">English</div>
                </div>

                <div :style="languageOptionStyle">
                  <div :style="radioStyle"></div>
                  <div :style="languageTextStyle">עברית (Hebrew)</div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        overlayStyle,
        modalStyle,
        headerStyle,
        titleStyle,
        closeBtnStyle,
        layoutStyle,
        sidebarStyle,
        tabBtnStyle,
        tabBtnActiveStyle,
        contentStyle,
        sectionHeadingStyle,
        settingGroupStyle,
        settingRowStyle,
        settingLabelStyle,
        settingDescStyle,
        themeButtonGroupStyle,
        themeButtonStyle,
        themeButtonActiveStyle,
        languageOptionStyle,
        languageOptionActiveStyle,
        radioStyle,
        radioActiveStyle,
        radioActiveInnerStyle,
        languageTextStyle,
      }
    },
  }),
}

// ============================================================================
// STORY 2: TIMER TAB
// ============================================================================

export const TimerTab: Story = {
  name: 'Timer Tab',
  render: () => ({
    components: { X, Timer, Palette, Layout, Bot, Database, User, Bell },
    template: `
      <div :style="overlayStyle">
        <div :style="modalStyle" @click.stop>
          <!-- Header -->
          <header :style="headerStyle">
            <h2 :style="titleStyle">Settings</h2>
            <button :style="closeBtnStyle">
              <X :size="16" />
            </button>
          </header>

          <!-- Layout: Sidebar + Content -->
          <div :style="layoutStyle">
            <!-- Sidebar -->
            <aside :style="sidebarStyle">
              <button :style="tabBtnStyle">
                <Palette :size="18" />
                <span>General</span>
              </button>
              <button :style="tabBtnActiveStyle">
                <Timer :size="18" />
                <span>Timer</span>
              </button>
              <button :style="tabBtnStyle">
                <Layout :size="18" />
                <span>Workflow</span>
              </button>
              <button :style="tabBtnStyle">
                <Bell :size="18" />
                <span>Notifications</span>
              </button>
              <button :style="tabBtnStyle">
                <Bot :size="18" />
                <span>AI & Weekly Plan</span>
              </button>
              <button :style="tabBtnStyle">
                <Database :size="18" />
                <span>Data & Backup</span>
              </button>
              <button :style="tabBtnStyle">
                <User :size="18" />
                <span>Account</span>
              </button>
            </aside>

            <!-- Content -->
            <main :style="contentStyle">
              <!-- Pomodoro Timer Section -->
              <div :style="settingGroupStyle">
                <h3 :style="sectionHeadingStyle">Pomodoro Timer</h3>

                <!-- Work Duration -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Work Duration</div>
                    <div :style="settingDescStyle">Time for focused work sessions</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--space-2);">
                    <input type="number" :style="inputStyle" value="25" />
                    <span style="font-size: var(--text-sm); color: var(--text-muted);">minutes</span>
                  </div>
                </div>

                <!-- Short Break -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Short Break</div>
                    <div :style="settingDescStyle">Break between work sessions</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--space-2);">
                    <input type="number" :style="inputStyle" value="5" />
                    <span style="font-size: var(--text-sm); color: var(--text-muted);">minutes</span>
                  </div>
                </div>

                <!-- Long Break -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Long Break</div>
                    <div :style="settingDescStyle">Break after 4 work sessions</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--space-2);">
                    <input type="number" :style="inputStyle" value="15" />
                    <span style="font-size: var(--text-sm); color: var(--text-muted);">minutes</span>
                  </div>
                </div>

                <!-- Auto-start Breaks -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Auto-start Breaks</div>
                    <div :style="settingDescStyle">Automatically start breaks when timer completes</div>
                  </div>
                  <div :style="toggleActiveStyle">
                    <div :style="toggleKnobActiveStyle"></div>
                  </div>
                </div>

                <!-- Sound Notifications -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Sound Notifications</div>
                    <div :style="settingDescStyle">Play sound when timer completes</div>
                  </div>
                  <div :style="toggleStyle">
                    <div :style="toggleKnobStyle"></div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        overlayStyle,
        modalStyle,
        headerStyle,
        titleStyle,
        closeBtnStyle,
        layoutStyle,
        sidebarStyle,
        tabBtnStyle,
        tabBtnActiveStyle,
        contentStyle,
        sectionHeadingStyle,
        settingGroupStyle,
        settingRowStyle,
        settingLabelStyle,
        settingDescStyle,
        inputStyle,
        toggleStyle,
        toggleActiveStyle,
        toggleKnobStyle,
        toggleKnobActiveStyle,
      }
    },
  }),
}

// ============================================================================
// STORY 3: DATA & BACKUP TAB
// ============================================================================

export const DataTab: Story = {
  name: 'Data & Backup Tab',
  render: () => ({
    components: { X, Timer, Palette, Layout, Bot, Database, User, Bell },
    template: `
      <div :style="overlayStyle">
        <div :style="modalStyle" @click.stop>
          <!-- Header -->
          <header :style="headerStyle">
            <h2 :style="titleStyle">Settings</h2>
            <button :style="closeBtnStyle">
              <X :size="16" />
            </button>
          </header>

          <!-- Layout: Sidebar + Content -->
          <div :style="layoutStyle">
            <!-- Sidebar -->
            <aside :style="sidebarStyle">
              <button :style="tabBtnStyle">
                <Palette :size="18" />
                <span>General</span>
              </button>
              <button :style="tabBtnStyle">
                <Timer :size="18" />
                <span>Timer</span>
              </button>
              <button :style="tabBtnStyle">
                <Layout :size="18" />
                <span>Workflow</span>
              </button>
              <button :style="tabBtnStyle">
                <Bell :size="18" />
                <span>Notifications</span>
              </button>
              <button :style="tabBtnStyle">
                <Bot :size="18" />
                <span>AI & Weekly Plan</span>
              </button>
              <button :style="tabBtnActiveStyle">
                <Database :size="18" />
                <span>Data & Backup</span>
              </button>
              <button :style="tabBtnStyle">
                <User :size="18" />
                <span>Account</span>
              </button>
            </aside>

            <!-- Content -->
            <main :style="contentStyle">
              <!-- Storage Section -->
              <div :style="settingGroupStyle">
                <h3 :style="sectionHeadingStyle">Storage</h3>

                <!-- Auto-backup -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Auto-backup</div>
                    <div :style="settingDescStyle">Automatically backup data every 5 minutes</div>
                  </div>
                  <div :style="toggleActiveStyle">
                    <div :style="toggleKnobActiveStyle"></div>
                  </div>
                </div>

                <!-- Cloud Sync -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Cloud Sync</div>
                    <div :style="settingDescStyle">Sync data across devices via Supabase</div>
                  </div>
                  <div :style="toggleActiveStyle">
                    <div :style="toggleKnobActiveStyle"></div>
                  </div>
                </div>

                <!-- Storage Info -->
                <div :style="settingRowStyle">
                  <div>
                    <div :style="settingLabelStyle">Storage Used</div>
                    <div :style="settingDescStyle">Local database size</div>
                  </div>
                  <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-semibold);">
                    2.4 MB
                  </div>
                </div>
              </div>

              <!-- Data Management Section -->
              <div :style="settingGroupStyle">
                <h3 :style="sectionHeadingStyle">Data Management</h3>

                <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
                  <button :style="actionButtonStyle">Export Data</button>
                  <button :style="actionButtonStyle">Import Data</button>
                  <button :style="actionButtonStyle">Download Backup</button>
                  <button :style="actionButtonStyle">Restore Backup</button>
                </div>
              </div>

              <!-- Danger Zone Section -->
              <div :style="settingGroupStyle">
                <h3 :style="sectionHeadingStyle" style="color: var(--color-error);">Danger Zone</h3>

                <div :style="settingRowStyle" style="border-color: var(--color-error); background: rgba(220, 38, 38, 0.05);">
                  <div>
                    <div :style="settingLabelStyle" style="color: var(--color-error);">Clear All Data</div>
                    <div :style="settingDescStyle">Permanently delete all tasks, projects, and settings</div>
                  </div>
                  <button
                    :style="actionButtonStyle"
                    style="border-color: var(--color-error); color: var(--color-error);"
                  >
                    Clear Data
                  </button>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        overlayStyle,
        modalStyle,
        headerStyle,
        titleStyle,
        closeBtnStyle,
        layoutStyle,
        sidebarStyle,
        tabBtnStyle,
        tabBtnActiveStyle,
        contentStyle,
        sectionHeadingStyle,
        settingGroupStyle,
        settingRowStyle,
        settingLabelStyle,
        settingDescStyle,
        toggleStyle,
        toggleActiveStyle,
        toggleKnobStyle,
        toggleKnobActiveStyle,
        actionButtonStyle,
      }
    },
  }),
}
