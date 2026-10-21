import { Fragment, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useTabParam } from '../../hooks/useTabParam'

export interface TabItem {
  /** Value stored in the URL (`?tab=<id>`). Lowercase, URL-safe. */
  id: string
  /** Short text label (one word fits best at 390 px with five tabs). */
  label: string
  /** Optional icon (for example a 16 px Lucide icon with `aria-hidden`). Shown before the label, above it below 900 px. */
  icon?: ReactNode
  content: ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  /** Accessible name of the tab list, for example "Study brief sections". */
  label: string
  /** `tabs`: segmented row plus the active panel. `stacked`: every panel in order, no tab row (desktop default). */
  mode: 'tabs' | 'stacked'
  /** Tab shown when the URL has no (or an unknown) value. Defaults to the first tab. */
  defaultTab?: string
  /** Search param name. Defaults to `tab`. */
  param?: string
  className?: string
}

/**
 * Segmented, scroll-free row of 2 to 5 text tabs synced to `?tab=`. Arrow keys, Home and End move between tabs.
 * Below 900 px the row is sticky under the top bar (see `.tabs` in base.css). Tabs may carry an `icon`.
 */
export function Tabs({ tabs, label, mode, defaultTab, param = 'tab', className }: TabsProps) {
  const ids = tabs.map((tab) => tab.id)
  const [active, select] = useTabParam(ids, defaultTab ?? ids[0], param)
  const baseId = useId()
  const sentinel = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const buttons = useRef<Map<string, HTMLButtonElement>>(new Map())

  if (mode === 'stacked') return <>{tabs.map((tab) => <Fragment key={tab.id}>{tab.content}</Fragment>)}</>

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  function choose(id: string, focus = false) {
    if (id !== active) {
      select(id)
      // If the row is stuck under the top bar, bring the new panel's top into view instead of keeping the old scroll depth.
      // The offset is the sticky row's own `top` (the top bar height on mobile, 0 when a page makes it sticky on desktop).
      const marker = sentinel.current
      if (marker) {
        const rowStyle = row.current ? getComputedStyle(row.current) : null
        const offset = rowStyle?.position === 'sticky' ? parseFloat(rowStyle.top) || 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 0
        const top = marker.getBoundingClientRect().top + window.scrollY - offset
        if (window.scrollY > top) window.scrollTo({ top })
      }
    }
    if (focus) buttons.current.get(id)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = ids.indexOf(current.id)
    const target = event.key === 'ArrowRight' ? ids[(index + 1) % ids.length]
      : event.key === 'ArrowLeft' ? ids[(index - 1 + ids.length) % ids.length]
      : event.key === 'Home' ? ids[0]
      : event.key === 'End' ? ids[ids.length - 1]
      : null
    if (!target) return
    event.preventDefault()
    choose(target, true)
  }

  const tabId = (id: string) => `${baseId}-tab-${id}`
  const panelId = (id: string) => `${baseId}-panel-${id}`

  return <div className={`tabs-root${className ? ` ${className}` : ''}`}>
    <div className="tabs-sentinel" ref={sentinel} aria-hidden="true" />
    <div className="tabs" ref={row}>
      <div role="tablist" aria-label={label} className={`tabs-list${tabs.some((tab) => tab.icon) ? ' has-icons' : ''}`} data-count={tabs.length} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === current.id
          return <button
            key={tab.id}
            ref={(node) => { if (node) buttons.current.set(tab.id, node); else buttons.current.delete(tab.id) }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            className={`tab${selected ? ' is-active' : ''}`}
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(tab.id)}
          >{tab.icon ? <>{tab.icon}<span className="tab-label">{tab.label}</span></> : tab.label}</button>
        })}
      </div>
    </div>
    <div role="tabpanel" id={panelId(current.id)} aria-labelledby={tabId(current.id)} className="tab-panel">{current.content}</div>
  </div>
}
