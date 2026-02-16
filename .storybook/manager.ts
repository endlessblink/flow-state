import React from 'react'
import { addons } from 'storybook/manager-api'
import customTheme from './theme'

// QA Tracker — per-component checkbox in sidebar with timestamp
// State persisted in localStorage under 'storybook-qa-tracker'
const QA_KEY = 'storybook-qa-tracker'
const QA_FILTER_KEY = 'storybook-qa-filter-active'

function getQAStore(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(QA_KEY) || '{}') }
  catch { return {} }
}

function isQAFilterActive(): boolean {
  return localStorage.getItem(QA_FILTER_KEY) === 'true'
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
    // Notify filter to re-evaluate
    window.dispatchEvent(new Event('qa-store-changed'))
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

// QA Filter — DOM-based CSS filtering of reviewed sidebar items
// Uses data-item-id and data-parent-id attributes on .sidebar-item elements
const BUTTON_ID = 'qa-filter-toggle'
const STYLE_ID = 'qa-filter-style'

// Check if an item or any of its ancestors is in the QA store
function isItemOrAncestorChecked(itemId: string, checkedIds: Set<string>): boolean {
  if (checkedIds.has(itemId)) return true
  const el = document.querySelector(`.sidebar-item[data-item-id="${CSS.escape(itemId)}"]`)
  if (!el) return false
  const parentId = el.getAttribute('data-parent-id')
  if (parentId) return isItemOrAncestorChecked(parentId, checkedIds)
  return false
}

// Apply or remove CSS hiding on sidebar items
function applyQAFilter() {
  if (!isQAFilterActive()) {
    // Remove all hiding
    document.querySelectorAll('.sidebar-item[data-qa-hidden]').forEach(el => {
      el.removeAttribute('data-qa-hidden')
    })
    return
  }

  const qa = getQAStore()
  const checkedIds = new Set(Object.keys(qa))
  if (checkedIds.size === 0) return

  // Pass 1: mark items whose ID or ancestor is checked
  document.querySelectorAll('.sidebar-item[data-item-id]').forEach(el => {
    const itemId = el.getAttribute('data-item-id')!
    if (isItemOrAncestorChecked(itemId, checkedIds)) {
      el.setAttribute('data-qa-hidden', 'true')
    } else {
      el.removeAttribute('data-qa-hidden')
    }
  })

  // Pass 2: auto-hide groups where ALL direct children are hidden
  document.querySelectorAll('.sidebar-item[data-nodetype="group"]:not([data-qa-hidden])').forEach(groupEl => {
    const groupId = groupEl.getAttribute('data-item-id')!
    const children = document.querySelectorAll(`.sidebar-item[data-parent-id="${CSS.escape(groupId)}"]`)
    if (children.length > 0 && Array.from(children).every(c => c.hasAttribute('data-qa-hidden'))) {
      groupEl.setAttribute('data-qa-hidden', 'true')
    }
  })
}

// Inject the CSS rule that hides marked items
function ensureFilterStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = '.sidebar-item[data-qa-hidden="true"] { display: none !important; }'
  document.head.appendChild(style)
}

function styleButton(btn: HTMLElement, active: boolean) {
  Object.assign(btn.style, {
    background: active ? 'rgba(78, 205, 196, 0.15)' : 'transparent',
    border: active ? '1px solid rgba(78, 205, 196, 0.4)' : '1px solid transparent',
    color: active ? '#4ECDC4' : 'rgba(255,255,255,0.5)',
  })
  btn.title = active ? 'Showing unreviewed only — click to show all' : 'Show unreviewed stories only'
  btn.textContent = active ? '☑ QA' : '☐ QA'
}

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return

  const tagFilterBtn = document.querySelector('button[aria-label="Tag filters"]') as HTMLElement
  if (!tagFilterBtn) {
    requestAnimationFrame(injectButton)
    return
  }

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  Object.assign(btn.style, {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
    fontSize: '11px', fontWeight: '500', fontFamily: 'inherit',
    lineHeight: '1', transition: 'all 0.15s ease', marginLeft: '4px',
    whiteSpace: 'nowrap',
  })
  styleButton(btn, isQAFilterActive())

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const next = !isQAFilterActive()
    localStorage.setItem(QA_FILTER_KEY, String(next))
    styleButton(btn, next)
    applyQAFilter()
  })

  tagFilterBtn.after(btn)
}

// Initialize: inject style + button, apply filter, observe DOM changes
ensureFilterStyle()
setTimeout(() => {
  injectButton()
  applyQAFilter()
}, 1500)

// Re-apply when QA checkboxes toggled
window.addEventListener('qa-store-changed', () => {
  applyQAFilter()
})

// Re-inject button + re-apply filter when sidebar re-renders
new MutationObserver(() => {
  if (!document.getElementById(BUTTON_ID)) injectButton()
  if (isQAFilterActive()) applyQAFilter()
}).observe(document.body, { childList: true, subtree: true })

// Configure Storybook manager UI to use dark theme with organized sidebar
addons.setConfig({
  theme: customTheme,

  sidebar: {
    showRoots: false,
    collapsedRoots: [],
    renderLabel: (item: any) => {
      // Add QA checkbox to component-level AND group/folder items
      if (item.type === 'component' || item.type === 'group') {
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
