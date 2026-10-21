import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { usePopover } from './usePopover'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Optional second line in the open list. */
  description?: string
}

export interface SelectProps<T extends string = string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** `md` is 40 px tall (default); `sm` is 36 px for dense rows. */
  size?: 'md' | 'sm'
  /** Accessible name when there is no visible label. */
  label?: string
  /** Id of a visible label element; takes precedence over `label`. */
  labelledBy?: string
  id?: string
  disabled?: boolean
  className?: string
  /** Horizontal alignment of the list under the button. */
  align?: 'start' | 'end'
}

const TYPEAHEAD_RESET_MS = 600

/**
 * Button that opens a popover list (`role="listbox"`). Keyboard: ArrowUp / ArrowDown, Home / End,
 * Enter or Space to choose, Escape or Tab to close, and type-ahead on the option labels.
 * Closes on outside click. Styled from tokens (`.select-*` in base.css).
 */
export function Select<T extends string = string>({ value, options, onChange, size = 'md', label, labelledBy, id, disabled, className, align = 'start' }: SelectProps<T>) {
  const { open, setOpen, close, rootRef, panelRef, triggerRef } = usePopover<HTMLButtonElement>()
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const buttonId = id ?? `${baseId}-button`
  const listId = `${baseId}-list`
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [active, setActive] = useState(selectedIndex)
  const typeahead = useRef({ text: '', at: 0 })
  const selected = options.find((option) => option.value === value)

  function openList(index = selectedIndex) {
    if (disabled) return
    setActive(index)
    setOpen(true)
    // Focus the list after it renders so arrow keys and aria-activedescendant work.
    requestAnimationFrame(() => {
      listRef.current?.focus()
      listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  }

  function choose(index: number) {
    const option = options[index]
    close(true)
    if (option && option.value !== value) onChange(option.value)
  }

  function move(index: number) {
    const next = Math.min(options.length - 1, Math.max(0, index))
    setActive(next)
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  function findByText(key: string, from: number) {
    const now = Date.now()
    const state = typeahead.current
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? key : state.text + key
    state.at = now
    const query = state.text.toLowerCase()
    const ordered = [...options.slice(from), ...options.slice(0, from)]
    const start = state.text.length === 1 ? 1 : 0 // a single repeated key cycles to the next match
    const match = [...ordered.slice(start), ...ordered.slice(0, start)].find((option) => option.label.toLowerCase().startsWith(query))
    return match ? options.indexOf(match) : -1
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const index = findByText(event.key, selectedIndex)
      if (index >= 0) openList(index)
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'ArrowDown': move(active + 1); break
      case 'ArrowUp': move(active - 1); break
      case 'Home': move(0); break
      case 'End': move(options.length - 1); break
      case 'Enter': case ' ': choose(active); break
      case 'Escape': close(true); break
      case 'Tab': close(false); return
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const index = findByText(event.key, active)
          if (index >= 0) move(index)
          break
        }
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return <div ref={rootRef} className={`select select-${size}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
    <button
      ref={triggerRef}
      id={buttonId}
      type="button"
      className="select-button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-label={labelledBy ? undefined : label ? `${label}: ${selected?.label ?? ''}` : undefined}
      aria-labelledby={labelledBy ? `${labelledBy} ${buttonId}` : undefined}
      disabled={disabled}
      onClick={() => (open ? close(false) : openList())}
      onKeyDown={onButtonKeyDown}
    >
      <span className="select-value">{selected?.label ?? ''}</span>
      <ChevronDown className="select-chevron" size={16} aria-hidden="true" />
    </button>
    {open && <div ref={panelRef} className={`popover-panel select-panel is-${align}`}>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-activedescendant={`${listId}-${active}`}
        onKeyDown={onListKeyDown}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value
          return <li
            key={option.value}
            id={`${listId}-${index}`}
            data-index={index}
            role="option"
            aria-selected={isSelected}
            className={`select-option${index === active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
            onPointerMove={() => { if (index !== active) setActive(index) }}
            onClick={() => choose(index)}
          >
            <span className="select-option-text">
              <span>{option.label}</span>
              {option.description && <small>{option.description}</small>}
            </span>
            {isSelected && <Check size={15} aria-hidden="true" />}
          </li>
        })}
      </ul>
    </div>}
  </div>
}
