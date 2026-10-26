import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePopover } from './usePopover'
import { addDays, addMonths, formatDisplayDate, fromIsoDate, monthGrid, sameDay, toIsoDate, weekdayLabels } from './date-utils'

export interface DateFieldProps {
  /** ISO date `YYYY-MM-DD`, or null when empty. */
  value: string | null
  onChange: (value: string | null) => void
  /** Text shown when empty. Defaults to "Target date". */
  placeholder?: string
  /** Accessible name, for example "Target date". Defaults to the placeholder. */
  label?: string
  /** `md` is 40 px tall (default); `sm` is 36 px. */
  size?: 'md' | 'sm'
  disabled?: boolean
  className?: string
  align?: 'start' | 'end'
}

/**
 * Text-styled button showing the date ("12 Nov 2026") or a placeholder. Opens a month calendar popover with
 * previous / next month, Today and Clear. Keyboard in the grid: arrows move by day / week, PageUp / PageDown by
 * month, Home / End to the start / end of the week, Enter or Space to choose, Escape to close.
 */
export function DateField({ value, onChange, placeholder = 'Target date', label, size = 'md', disabled, className, align = 'start' }: DateFieldProps) {
  const { open, setOpen, close, rootRef, panelRef, triggerRef } = usePopover<HTMLButtonElement>()
  const gridRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const selected = fromIsoDate(value)
  const [focused, setFocused] = useState<Date>(() => selected ?? today())
  const name = label ?? placeholder

  function focusDay(date: Date) {
    setFocused(date)
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${toIsoDate(date)}"]`)?.focus())
  }

  function openCalendar() {
    if (disabled) return
    setOpen(true)
    focusDay(selected ?? today())
  }

  function choose(date: Date | null) {
    close(true)
    const next = date ? toIsoDate(date) : null
    if (next !== value) onChange(next)
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const weekday = (focused.getDay() + 6) % 7 // Monday = 0
    const next = event.key === 'ArrowLeft' ? addDays(focused, -1)
      : event.key === 'ArrowRight' ? addDays(focused, 1)
      : event.key === 'ArrowUp' ? addDays(focused, -7)
      : event.key === 'ArrowDown' ? addDays(focused, 7)
      : event.key === 'PageUp' ? addMonths(focused, -1)
      : event.key === 'PageDown' ? addMonths(focused, 1)
      : event.key === 'Home' ? addDays(focused, -weekday)
      : event.key === 'End' ? addDays(focused, 6 - weekday)
      : null
    if (!next) return
    event.preventDefault()
    focusDay(next)
  }

  const now = today()
  const weeks = monthGrid(focused.getFullYear(), focused.getMonth())
  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(focused)
  const titleId = `${baseId}-title`

  return <div ref={rootRef} className={`select date-field select-${size}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
    <button
      ref={triggerRef}
      type="button"
      className={`select-button${selected ? '' : ' is-placeholder'}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={selected ? `${name}: ${formatDisplayDate(selected)}` : `${name}: not set`}
      disabled={disabled}
      onClick={() => (open ? close(false) : openCalendar())}
      onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); openCalendar() } }}
    >
      <CalendarDays className="select-lead-icon" size={15} aria-hidden="true" />
      <span className="select-value">{selected ? formatDisplayDate(selected) : placeholder}</span>
      <ChevronDown className="select-chevron" size={16} aria-hidden="true" />
    </button>
    {open && <div ref={panelRef} className={`popover-panel calendar is-${align}`} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <div className="calendar-head">
        <button type="button" className="icon-button" aria-label="Previous month" onClick={() => focusDay(addMonths(focused, -1))}><ChevronLeft size={16} /></button>
        <strong id={titleId} aria-live="polite">{monthLabel}</strong>
        <button type="button" className="icon-button" aria-label="Next month" onClick={() => focusDay(addMonths(focused, 1))}><ChevronRight size={16} /></button>
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={titleId} className="calendar-grid" onKeyDown={onGridKeyDown}>
        <div role="row" className="calendar-row">
          {weekdayLabels.map((day) => <span key={day.short} role="columnheader" aria-label={day.long} className="calendar-weekday">{day.short}</span>)}
        </div>
        {weeks.map((week) => <div role="row" className="calendar-row" key={toIsoDate(week[0])}>
          {week.map((day) => {
            const outside = day.getMonth() !== focused.getMonth()
            const isSelected = sameDay(day, selected)
            const isFocused = sameDay(day, focused)
            return <span role="gridcell" key={toIsoDate(day)} aria-selected={isSelected}>
              <button
                type="button"
                data-date={toIsoDate(day)}
                tabIndex={isFocused ? 0 : -1}
                className={`calendar-day${outside ? ' is-outside' : ''}${isSelected ? ' is-selected' : ''}${sameDay(day, now) ? ' is-today' : ''}`}
                aria-label={formatDisplayDate(day)}
                aria-current={sameDay(day, now) ? 'date' : undefined}
                onClick={() => choose(day)}
              >{day.getDate()}</button>
            </span>
          })}
        </div>)}
      </div>
      <div className="calendar-foot">
        <button type="button" className="text-button" onClick={() => choose(now)}>Today</button>
        <button type="button" className="text-button calendar-clear" disabled={!selected} onClick={() => choose(null)}>Clear</button>
      </div>
    </div>}
  </div>
}

function today() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
