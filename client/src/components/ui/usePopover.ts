import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const VIEWPORT_GUTTER = 8

/**
 * Open state for a small anchored popover (Select, DateField, source chips).
 * - Closes on a pointer press outside `rootRef` and on Escape (focus returns to the trigger).
 * - While open, nudges `panelRef` horizontally so it stays inside the viewport (no horizontal scroll at 390 px).
 * The panel is expected to be absolutely positioned inside the root (see `.popover-panel` in base.css; `.is-end` aligns it right).
 */
export function usePopover<TTrigger extends HTMLElement = HTMLButtonElement, TRoot extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<TRoot>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<TTrigger>(null)

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close(true)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [close, open])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    panel.style.marginLeft = ''
    panel.style.marginRight = ''
    const rect = panel.getBoundingClientRect()
    const limit = document.documentElement.clientWidth - VIEWPORT_GUTTER
    const shift = rect.right > limit ? limit - rect.right : rect.left < VIEWPORT_GUTTER ? VIEWPORT_GUTTER - rect.left : 0
    // Margins (not transforms) so the untransformed box never widens the page's scrollable area.
    if (!shift) return
    if (panel.classList.contains('is-end')) panel.style.marginRight = `${Math.round(-shift)}px`
    else panel.style.marginLeft = `${Math.round(shift)}px`
  }, [open])

  return { open, setOpen, close, rootRef, panelRef, triggerRef }
}
