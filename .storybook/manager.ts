import React from 'react'
import { addons } from 'storybook/manager-api'
import customTheme from './theme'

// QA Tracker — per-component checkbox in sidebar with timestamp
// State persisted in localStorage under 'storybook-qa-tracker'
const QA_KEY = 'storybook-qa-tracker'

function getQAStore(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(QA_KEY) || '{}') }
  catch { return {} }
}

function QALabel({ item }: { item: any }) {
  const [testedAt, setTestedAt] = React.useState<string | null>(() => {
    return getQAStore()[item.id] || null
  })

  const toggle = (e: any) => {
    e.stopPropagation()
    e.preventDefault()
    const data = getQAStore()
    if (testedAt) {
      delete data[item.id]
      setTestedAt(null)
    } else {
      const now = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      })
      data[item.id] = now
      setTestedAt(now)
    }
    localStorage.setItem(QA_KEY, JSON.stringify(data))
  }

  return React.createElement('span', {
    style: { display: 'flex', flexDirection: 'column' as const, width: '100%', gap: '1px' }
  },
    // Row 1: checkbox + name
    React.createElement('span', {
      style: { display: 'flex', alignItems: 'center', gap: '6px' }
    },
      React.createElement('input', {
        type: 'checkbox',
        checked: !!testedAt,
        onClick: toggle,
        onChange: () => {},
        style: {
          width: '13px', height: '13px', accentColor: '#4ECDC4',
          cursor: 'pointer', flexShrink: 0, margin: 0
        }
      }),
      React.createElement('span', {
        style: {
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
          color: testedAt ? '#4ECDC4' : 'inherit'
        }
      }, item.name)
    ),
    // Row 2: timestamp (only when tested)
    testedAt ? React.createElement('span', {
      style: {
        fontSize: '9px', color: 'rgba(255,255,255,0.4)',
        paddingLeft: '19px', lineHeight: '1'
      }
    }, testedAt) : null
  )
}

// Configure Storybook manager UI to use dark theme with organized sidebar
addons.setConfig({
  theme: customTheme,

  sidebar: {
    showRoots: false, // Makes top-level categories collapsible folders (not all-caps roots)
    collapsedRoots: [], // All categories expanded by default
    renderLabel: (item: any) => {
      // Only add QA checkbox to component-level items
      if (item.type === 'component') {
        return React.createElement(QALabel, { item, key: item.id })
      }
      return item.name
    }
  },

  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
})
