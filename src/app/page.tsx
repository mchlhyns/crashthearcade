'use client'

import { useEffect, useState, useRef } from 'react'
import { restoreSession, signIn } from '@/lib/atproto'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [handle, setHandle] = useState('')
  const [loginError, setLoginError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ did: string; handle: string; displayName?: string; avatar?: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const typeaheadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    restoreSession().then((s) => {
      if (s) { window.location.href = '/home'; return }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const q = handle.trim().replace(/^@/, '')
    if (q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=6`
        )
        const data = await res.json()
        setSuggestions(data.actors ?? [])
        setShowSuggestions(true)
        setSuggestionIndex(-1)
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [handle])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (typeaheadRef.current && !typeaheadRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function selectSuggestion(selectedHandle: string) {
    setHandle(selectedHandle)
    setShowSuggestions(false)
    setSuggestions([])
  }

  function handleHandleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && suggestionIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[suggestionIndex].handle)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!handle.trim()) return
    setSigningIn(true)
    setLoginError('')
    try {
      await signIn(handle.trim().replace(/^@/, ''))
    } catch {
      setLoginError('Could not sign in. Check your handle and try again.')
      setSigningIn(false)
    }
  }

  if (loading) return null

  return (
    <div className="login-page">
      <div>
        <img src="/cta-wide-logo.png" alt="CRASH THE ARCADE" style={{ height: 18, marginBottom: 12 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Track your games</p>
      </div>
      <div className="login-box">
        <h2>Sign in</h2>
        <p>Enter your Bluesky handle to get started.</p>
        <form onSubmit={handleSignIn}>
          <div className="input-row">
            <div ref={typeaheadRef} className="handle-typeahead">
              <input
                className="input"
                type="text"
                placeholder="you.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={handleHandleKeyDown}
                autoFocus
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="handle-suggestions">
                  {suggestions.map((actor, i) => (
                    <div
                      key={actor.did}
                      className={`handle-suggestion${i === suggestionIndex ? ' active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(actor.handle) }}
                    >
                      {actor.avatar
                        ? <img src={actor.avatar} alt="" className="handle-suggestion-avatar" />
                        : <div className="handle-suggestion-avatar handle-suggestion-avatar-placeholder" />
                      }
                      <div>
                        {actor.displayName && <div className="handle-suggestion-name">{actor.displayName}</div>}
                        <div className="handle-suggestion-handle">@{actor.handle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-primary" type="submit" disabled={signingIn}>
              {signingIn ? '...' : 'Sign in'}
            </button>
          </div>
          {loginError && <p className="error-msg">{loginError}</p>}
        </form>
      </div>
    </div>
  )
}
