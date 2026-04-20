'use client'

import { useState, useEffect } from 'react'
import { Agent } from '@atproto/api'
import { restoreSession, signOut } from '@/lib/atproto'
import HeaderMenu from '@/components/HeaderMenu'
import MobileMenu from '@/components/MobileMenu'
import NavDropdown from '@/components/NavDropdown'

export default function GamePageHeader() {
  const [session, setSession] = useState<{ agent: Agent; did: string } | null>(null)
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    restoreSession()
      .then((s) => {
        if (s) {
          setSession(s)
          s.agent.com.atproto.repo.describeRepo({ repo: s.did })
            .then((res) => setUserHandle(res.data.handle))
            .catch(() => {})
        }
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])

  async function handleSignOut() {
    if (!session) return
    await signOut(session.did)
    window.location.href = '/'
  }

  return (
    <header>
      <div className="container">
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
          <span className="header-site-name">CRASH THE ARCADE</span>
        </a>
        {ready && session ? (
          <>
            <nav className="header-desktop-nav">
              <a href="/discover" className="nav-link">Discover</a>
              <a href="/social" className="nav-link">Social</a>
              <NavDropdown
                label="Your collection"
                items={[
                  { label: 'Games', href: '/games' },
                  { label: 'Lists', href: '/lists' },
                ]}
              />
              <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
            </nav>
            <MobileMenu userHandle={userHandle} onSignOut={handleSignOut} />
          </>
        ) : ready ? (
          <a href="/" className="btn btn-ghost btn-sm">
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </a>
        ) : null}
      </div>
    </header>
  )
}
