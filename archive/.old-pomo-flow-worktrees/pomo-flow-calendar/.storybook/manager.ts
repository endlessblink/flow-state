import { addons } from 'storybook/manager-api'
import { themes } from 'storybook/theming'

// Configure Storybook manager UI to use dark theme with organized sidebar
addons.setConfig({
  theme: themes.dark,

  sidebar: {
    showRoots: false, // Makes top-level categories collapsible folders (not all-caps roots)
    collapsedRoots: [], // All categories expanded by default
  },

  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
})
