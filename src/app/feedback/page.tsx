'use client'

import { useEffect, useRef, useState } from 'react'
import { restoreSession, signOut } from '@/lib/atproto'
import HeaderMenu from '@/components/HeaderMenu'
import MobileMenu from '@/components/MobileMenu'

export default function FeedbackPage() {
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [did, setDid] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    restoreSession()
      .then((s) => {
        if (!s) { setLoaded(true); return }
        setDid(s.did)
        s.agent.com.atproto.repo.describeRepo({ repo: s.did })
          .then((res) => setUserHandle(res.data.handle))
          .catch(() => {})
          .finally(() => setLoaded(true))
      })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    function onScroll() {
      if (headerRef.current) {
        headerRef.current.classList.toggle('scrolled', window.scrollY > 4)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleSignOut() {
    if (did) signOut(did).finally(() => { window.location.href = '/' })
    else window.location.href = '/'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send.')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message ?? 'Failed to send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header ref={headerRef}>
        <div className="container">
          <a href="/discover" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          {loaded && (userHandle ? (
            <>
              <nav className="header-desktop-nav">
                <a href="/discover" className="nav-link">Discover</a>
                <a href="/social" className="nav-link">Social</a>
                <HeaderMenu userHandle={userHandle} onSignOut={handleSignOut} />
              </nav>
              <MobileMenu userHandle={userHandle} onSignOut={handleSignOut} />
            </>
          ) : (
            <a href="/" className="btn btn-ghost btn-sm">
              Sign in
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </a>
          ))}
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1>Feedback</h1>
          </div>

          <div className="faq-section-container feedback-form">
            {submitted ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                Thanks for your feedback! We'll be in touch if we have any questions.
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-field">
                  <label>Name</label>
                  <input
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Message</label>
                  <textarea
                    className="input"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's on your mind?"
                    required
                  />
                </div>
                {error && <p className="error-msg" style={{ marginBottom: 14 }}>{error}</p>}
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
