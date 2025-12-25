import type { Meta, StoryObj } from '@storybook/vue3'

const meta: Meta = {
  title: '🛸 Design System/Colors',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'Choose the primary brand color for PomoFlow. This color will be used consistently across all views for selected states, primary actions, and brand identity.'
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const TealOption: Story = {
  name: '✅ RECOMMENDED: TEAL (#4ECDC4)',
  render: () => ({
    template: `
      <div class="space-y-8 p-8 text-white min-h-screen" style="background: var(--app-background-gradient);">
        <div>
          <h1 class="text-3xl font-bold mb-2">Option A: TEAL Primary</h1>
          <p class="text-gray-400">Modern, distinctive, productive aesthetic</p>
        </div>

        <!-- Color Swatches -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Color Swatches</h2>
          <div class="flex gap-4">
            <div class="space-y-2">
              <div class="w-32 h-32 rounded-lg flex items-center justify-center font-bold"
                   style="background: transparent; border: 2px solid #4ECDC4; color: #4ECDC4">
                PRIMARY
              </div>
              <div class="text-sm">
                <div class="font-semibold" style="color: #4ECDC4">#4ECDC4</div>
                <div class="text-gray-400">var(--brand-primary)</div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="w-32 h-32 rounded-lg flex items-center justify-center font-bold"
                   style="background: transparent; border: 2px solid #3db8af; color: #3db8af">
                HOVER
              </div>
              <div class="text-sm">
                <div class="font-semibold" style="color: #3db8af">#3db8af</div>
                <div class="text-gray-400">--brand-primary-hover</div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="w-32 h-32 rounded-lg flex items-center justify-center font-bold"
                   style="background: transparent; border: 2px solid #2da39a; color: #2da39a">
                ACTIVE
              </div>
              <div class="text-sm">
                <div class="font-semibold" style="color: #2da39a">#2da39a</div>
                <div class="text-gray-400">--brand-primary-active</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Button Examples -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Button Examples</h2>
          <div class="flex flex-wrap gap-4">
            <button class="px-6 py-3 rounded-md font-semibold transition hover:bg-opacity-10"
                    style="background: transparent; border: 2px solid #4ECDC4; color: #4ECDC4">
              Primary Button
            </button>
            <button class="px-6 py-3 rounded-md font-semibold transition hover:bg-opacity-10"
                    style="border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.7); background: transparent">
              Secondary Button
            </button>
            <button class="w-12 h-12 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                    style="background: transparent; border: 2px solid #4ECDC4">
              <svg width="20" height="20" fill="#4ECDC4" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Selected States -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Selected States</h2>
          <div class="flex gap-2">
            <button class="px-4 py-2 rounded-md font-medium transition"
                    style="background: transparent; border: 2px solid #4ECDC4; color: #4ECDC4">
              Active Tab
            </button>
            <button class="px-4 py-2 rounded-md font-medium text-gray-400"
                    style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              Inactive Tab
            </button>
          </div>
        </div>

        <!-- Icon Toolbar (Canvas Example) -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Canvas Toolbar Preview</h2>
          <div class="p-4 rounded-lg inline-block" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
            <div class="flex gap-2">
              <button class="w-10 h-10 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                      style="background: transparent; border: 2px solid #4ECDC4">
                <svg width="18" height="18" fill="#4ECDC4" viewBox="0 0 24 24">
                  <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                      style="background: transparent; border: 2px solid #4ECDC4">
                <svg width="18" height="18" fill="#4ECDC4" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                      style="background: transparent; border: 2px solid #4ECDC4">
                <svg width="18" height="18" fill="#4ECDC4" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Pros/Cons -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Analysis</h2>
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-lg p-4" style="background: transparent; border: 1px solid rgba(74, 222, 128, 0.3)">
              <h3 class="font-semibold text-green-400 mb-2">✅ Pros</h3>
              <ul class="space-y-1 text-sm text-gray-300">
                <li>• Already dominant in Canvas view</li>
                <li>• Modern, distinctive aesthetic</li>
                <li>• Calm, productive feeling</li>
                <li>• Used in theme toggle (established identity)</li>
              </ul>
            </div>
            <div class="rounded-lg p-4" style="background: transparent; border: 1px solid rgba(251, 191, 36, 0.3)">
              <h3 class="font-semibold text-yellow-400 mb-2">⚠️ Considerations</h3>
              <ul class="space-y-1 text-sm text-gray-300">
                <li>• Less common for productivity apps</li>
                <li>• Need to verify accessibility contrast</li>
                <li>• Will require updating All Tasks view</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Current Usage -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Current Usage in App</h2>
          <div class="rounded-lg p-4" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="border: 2px solid #4ECDC4; background: transparent"></div>
                <span class="text-gray-300">Canvas View - Toolbar buttons, theme toggle</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="border: 2px solid #4ECDC4; background: transparent"></div>
                <span class="text-gray-300">Board View - Selected tab indicator</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="border: 2px solid #4ECDC4; background: transparent"></div>
                <span class="text-gray-300">Settings Modal - Duration buttons (active state)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

export const BlueOption: Story = {
  name: '🔵 ALTERNATIVE: BLUE (#4A90E2)',
  render: () => ({
    template: `
      <div class="space-y-8 p-8 text-white min-h-screen" style="background: var(--app-background-gradient);">
        <div>
          <h1 class="text-3xl font-bold mb-2">Option B: BLUE Primary</h1>
          <p class="text-gray-400">Traditional, professional, trustworthy</p>
        </div>

        <!-- Color Swatches -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Color Swatches</h2>
          <div class="flex gap-4">
            <div class="space-y-2">
              <div class="w-32 h-32 rounded-lg flex items-center justify-center font-bold"
                   style="background: transparent; border: 2px solid #4A90E2; color: #4A90E2">
                PRIMARY
              </div>
              <div class="text-sm">
                <div class="font-semibold" style="color: #4A90E2">#4A90E2</div>
                <div class="text-gray-400">var(--brand-primary)</div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="w-32 h-32 rounded-lg flex items-center justify-center font-bold"
                   style="background: transparent; border: 2px solid #357ABD; color: #357ABD">
                HOVER
              </div>
              <div class="text-sm">
                <div class="font-semibold" style="color: #357ABD">#357ABD</div>
                <div class="text-gray-400">--brand-primary-hover</div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="w-32 h-32 rounded-lg flex items-center justify-center font-bold"
                   style="background: transparent; border: 2px solid #2E6BA8; color: #2E6BA8">
                ACTIVE
              </div>
              <div class="text-sm">
                <div class="font-semibold" style="color: #2E6BA8">#2E6BA8</div>
                <div class="text-gray-400">--brand-primary-active</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Button Examples -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Button Examples</h2>
          <div class="flex flex-wrap gap-4">
            <button class="px-6 py-3 rounded-md font-semibold transition hover:bg-opacity-10"
                    style="background: transparent; border: 2px solid #4A90E2; color: #4A90E2">
              Primary Button
            </button>
            <button class="px-6 py-3 rounded-md font-semibold transition hover:bg-opacity-10"
                    style="border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.7); background: transparent">
              Secondary Button
            </button>
            <button class="w-12 h-12 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                    style="background: transparent; border: 2px solid #4A90E2">
              <svg width="20" height="20" fill="#4A90E2" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Selected States -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Selected States</h2>
          <div class="flex gap-2">
            <button class="px-4 py-2 rounded-md font-medium transition"
                    style="background: transparent; border: 2px solid #4A90E2; color: #4A90E2">
              Active Tab
            </button>
            <button class="px-4 py-2 rounded-md font-medium text-gray-400"
                    style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              Inactive Tab
            </button>
          </div>
        </div>

        <!-- Icon Toolbar (Canvas Example) -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Canvas Toolbar Preview</h2>
          <div class="p-4 rounded-lg inline-block" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
            <div class="flex gap-2">
              <button class="w-10 h-10 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                      style="background: transparent; border: 2px solid #4A90E2">
                <svg width="18" height="18" fill="#4A90E2" viewBox="0 0 24 24">
                  <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                      style="background: transparent; border: 2px solid #4A90E2">
                <svg width="18" height="18" fill="#4A90E2" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-md flex items-center justify-center transition hover:bg-opacity-10"
                      style="background: transparent; border: 2px solid #4A90E2">
                <svg width="18" height="18" fill="#4A90E2" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Pros/Cons -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Analysis</h2>
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-lg p-4" style="background: transparent; border: 1px solid rgba(74, 222, 128, 0.3)">
              <h3 class="font-semibold text-green-400 mb-2">✅ Pros</h3>
              <ul class="space-y-1 text-sm text-gray-300">
                <li>• Traditional productivity app color</li>
                <li>• High trust/professionalism</li>
                <li>• Already used in All Tasks toggles</li>
                <li>• Familiar to users</li>
              </ul>
            </div>
            <div class="rounded-lg p-4" style="background: transparent; border: 1px solid rgba(251, 191, 36, 0.3)">
              <h3 class="font-semibold text-yellow-400 mb-2">⚠️ Considerations</h3>
              <ul class="space-y-1 text-sm text-gray-300">
                <li>• Less distinctive/generic</li>
                <li>• Less present in current design</li>
                <li>• Would require updating Canvas/Board</li>
                <li>• May feel less modern</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Current Usage -->
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">Current Usage in App</h2>
          <div class="rounded-lg p-4" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="border: 2px solid #4A90E2; background: transparent"></div>
                <span class="text-gray-300">All Tasks View - List/Table toggle selected state</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="border: 1px solid rgba(255, 255, 255, 0.3); background: transparent"></div>
                <span class="text-gray-400">Canvas View - NOT used (currently TEAL)</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="border: 1px solid rgba(255, 255, 255, 0.3); background: transparent"></div>
                <span class="text-gray-400">Board View - NOT used (currently TEAL)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

export const SideBySideComparison: Story = {
  name: '⚖️ Side-by-Side Comparison',
  render: () => ({
    template: `
      <div class="p-8 text-white min-h-screen" style="background: var(--app-background-gradient);">
        <h1 class="text-3xl font-bold mb-8">Primary Color Comparison</h1>

        <div class="grid grid-cols-2 gap-8">
          <!-- TEAL Column -->
          <div class="space-y-4">
            <h2 class="text-2xl font-semibold" style="color: #4ECDC4">TEAL #4ECDC4</h2>

            <!-- Button Set -->
            <div class="space-y-2">
              <button class="w-full px-6 py-3 rounded-md font-semibold"
                      style="background: transparent; border: 2px solid #4ECDC4; color: #4ECDC4">
                Primary Button
              </button>
              <button class="w-full px-6 py-3 rounded-md font-semibold"
                      style="border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.7); background: transparent">
                Secondary Button
              </button>
            </div>

            <!-- Tab Group -->
            <div class="flex gap-2 p-1 rounded-lg" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              <button class="flex-1 px-4 py-2 rounded-md font-medium"
                      style="background: transparent; border: 2px solid #4ECDC4; color: #4ECDC4">
                Board
              </button>
              <button class="flex-1 px-4 py-2 rounded-md font-medium text-gray-400"
                      style="background: transparent; border: 1px solid transparent">
                Calendar
              </button>
              <button class="flex-1 px-4 py-2 rounded-md font-medium text-gray-400"
                      style="background: transparent; border: 1px solid transparent">
                Canvas
              </button>
            </div>

            <!-- Toolbar -->
            <div class="flex gap-2 p-3 rounded-lg" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              <button class="w-10 h-10 rounded-md" style="background: transparent; border: 2px solid #4ECDC4">
                <svg width="18" height="18" fill="#4ECDC4" viewBox="0 0 24 24" class="mx-auto">
                  <path d="M3 3h8v8H3V3z"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-md" style="background: transparent; border: 2px solid #4ECDC4">
                <svg width="18" height="18" fill="#4ECDC4" viewBox="0 0 24 24" class="mx-auto">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
            </div>

            <!-- Visual Weight -->
            <div class="p-4 rounded-lg" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              <p class="text-sm text-gray-400 mb-2">Visual Weight:</p>
              <div class="space-y-1 text-sm">
                <div>✅ Energetic, modern</div>
                <div>✅ High visibility</div>
                <div>✅ Distinctive</div>
              </div>
            </div>
          </div>

          <!-- BLUE Column -->
          <div class="space-y-4">
            <h2 class="text-2xl font-semibold" style="color: #4A90E2">BLUE #4A90E2</h2>

            <!-- Button Set -->
            <div class="space-y-2">
              <button class="w-full px-6 py-3 rounded-md font-semibold"
                      style="background: transparent; border: 2px solid #4A90E2; color: #4A90E2">
                Primary Button
              </button>
              <button class="w-full px-6 py-3 rounded-md font-semibold"
                      style="border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.7); background: transparent">
                Secondary Button
              </button>
            </div>

            <!-- Tab Group -->
            <div class="flex gap-2 p-1 rounded-lg" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              <button class="flex-1 px-4 py-2 rounded-md font-medium"
                      style="background: transparent; border: 2px solid #4A90E2; color: #4A90E2">
                Board
              </button>
              <button class="flex-1 px-4 py-2 rounded-md font-medium text-gray-400"
                      style="background: transparent; border: 1px solid transparent">
                Calendar
              </button>
              <button class="flex-1 px-4 py-2 rounded-md font-medium text-gray-400"
                      style="background: transparent; border: 1px solid transparent">
                Canvas
              </button>
            </div>

            <!-- Toolbar -->
            <div class="flex gap-2 p-3 rounded-lg" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              <button class="w-10 h-10 rounded-md" style="background: transparent; border: 2px solid #4A90E2">
                <svg width="18" height="18" fill="#4A90E2" viewBox="0 0 24 24" class="mx-auto">
                  <path d="M3 3h8v8H3V3z"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-md" style="background: transparent; border: 2px solid #4A90E2">
                <svg width="18" height="18" fill="#4A90E2" viewBox="0 0 24 24" class="mx-auto">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
            </div>

            <!-- Visual Weight -->
            <div class="p-4 rounded-lg" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.1)">
              <p class="text-sm text-gray-400 mb-2">Visual Weight:</p>
              <div class="space-y-1 text-sm">
                <div>✅ Professional, trustworthy</div>
                <div>✅ Traditional, familiar</div>
                <div>⚠️ Less distinctive</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Decision Prompt -->
        <div class="mt-12 rounded-lg p-6" style="background: transparent; border: 1px solid rgba(147, 51, 234, 0.3)">
          <h3 class="text-xl font-semibold mb-4" style="color: #a855f7">📋 Make Your Decision</h3>
          <p class="text-gray-300 mb-4">
            Review both options above. The chosen color will be applied consistently across:
          </p>
          <ul class="space-y-2 text-sm text-gray-300 ml-6 mb-4">
            <li>• All toolbar buttons (Canvas, Board, Calendar)</li>
            <li>• Selected states (tabs, toggles, options)</li>
            <li>• Primary action buttons</li>
            <li>• Focus indicators</li>
            <li>• Border accents</li>
          </ul>
          <p class="font-semibold" style="color: #fbbf24">
            👉 Let me know which color you prefer, and I'll implement it throughout the app!
          </p>
        </div>
      </div>
    `
  })
}
