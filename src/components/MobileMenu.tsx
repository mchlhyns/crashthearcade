'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  userHandle: string | null
  onSignOut: () => void
}

export default function MobileMenu({ userHandle, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  return (
    <div ref={ref} className="mobile-menu">
      <button className="mobile-menu-trigger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="mobile-menu-dropdown">
          <a href="/discover" className="mobile-menu-item" onClick={() => setOpen(false)}>Discover</a>
          <a href="/social" className="mobile-menu-item" onClick={() => setOpen(false)}>Social</a>
          <a href="/games" className="mobile-menu-item" onClick={() => setOpen(false)}>Games</a>
          <a href="/lists" className="mobile-menu-item" onClick={() => setOpen(false)}>Lists</a>
          <div className="mobile-menu-divider" />
          {userHandle && (
            <a href={`/${userHandle}`} className="mobile-menu-item" onClick={() => setOpen(false)}>Profile</a>
          )}
          <a href="/settings" className="mobile-menu-item" onClick={() => setOpen(false)}>Settings</a>
          <div className="mobile-menu-divider" />
          <a
            href="https://bsky.app/profile/crashthearcade.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-menu-item"
            onClick={() => setOpen(false)}
          >
            Bluesky
          </a>
          <a
            href="https://github.com/mchlhyns/crashthearcade"
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-menu-item"
            onClick={() => setOpen(false)}
          >
            GitHub
          </a>
          <div className="mobile-menu-divider" />
          <button
            className="mobile-menu-item mobile-menu-item-signout"
            onClick={() => { setOpen(false); onSignOut() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
