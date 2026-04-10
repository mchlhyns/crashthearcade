'use client'

import { useState, useRef, useEffect } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  variant?: 'filter' | 'sort' | 'input'
}

export default function Select({ value, onChange, options, variant = 'input' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    const idx = options.findIndex((o) => o.value === value)
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = options[Math.min(idx + 1, options.length - 1)]
      if (next) onChange(next.value)
      setOpen(true)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = options[Math.max(idx - 1, 0)]
      if (prev) onChange(prev.value)
      setOpen(true)
    }
  }

  const chevron = (
    <svg
      className={`select-arrow${open ? ' open' : ''}`}
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )

  return (
    <div
      ref={ref}
      className={`select select-${variant}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="select-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{selected?.label ?? ''}</span>
        {chevron}
      </div>
      {open && (
        <div className="select-menu">
          {options.map((option) => (
            <div
              key={option.value}
              className={`select-option${option.value === value ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(option.value); setOpen(false) }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
