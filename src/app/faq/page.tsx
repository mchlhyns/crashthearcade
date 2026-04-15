'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import { restoreSession } from '@/lib/atproto'

type Section = { heading: string; items: { q: string; a: ReactNode }[] }

const sections: Section[] = [
  {
    heading: 'Authentication',
    items: [
      {
        q: 'How do I sign in?',
        a: <>You sign in with your <a href="https://atmosphereaccount.com/" target="_blank" rel="noopener noreferrer">Atmosphere Account</a>. This is the same one you use for Bluesky, Blacksky, Eurosky, or any of the other sites that support the AT Protocol.</>,
      },
    ],
  },
  {
    heading: 'Data & storage',
    items: [
      {
        q: 'Where is my data stored?',
        a: "Your game collection is stored as records in your AT Protocol repository, the same infrastructure that powers sites like Bluesky. This means your data lives on your Personal Data Server (PDS), not on our servers. You own it.",
      },
      {
        q: 'Can I take my data with me?',
        a: 'Yep. Your collection is stored in your PDS. If you ever delete your account or move PDS hosts, your records go with you.',
      },
      {
        q: 'Does CRASH THE ARCADE store anything on its own servers?',
        a: 'Game metadata (covers, titles, release dates) is fetched from IGDB and cached on our server. No personal data or collection records are stored though, only your PDS holds those.',
      },
    ],
  },
  {
    heading: 'Privacy',
    items: [
      {
        q: 'Is my collection public?',
        a: 'AT Protocol repositories are public by default, the same way Bluesky posts are. Anyone who knows your DID or handle can look up your collection records directly via the AT Protocol.',
      },
      {
        q: 'What analytics or tracking does the site use?',
        a: 'We do not use third-party analytics or advertising trackers. No personal data is sold or shared.',
      },
    ],
  },
]

export default function FaqPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    restoreSession().then((s) => setIsLoggedIn(!!s)).catch(() => {})
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

  return (
    <>
      <header ref={headerRef}>
        <div className="container">
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" style={{ height: 18, lineHeight: 0 }} />
            <span className="header-site-name">CRASH THE ARCADE</span>
          </a>
          <a href={isLoggedIn ? '/discover' : '/'} className="btn btn-primary">
            {isLoggedIn ? 'Home' : 'Sign in'}
            {isLoggedIn ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            )}
          </a>
        </div>
      </header>

      <main>
        <div className="container">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1>FAQ</h1>
          </div>

          <div style={{ maxWidth: 480 }}>
            {sections.map((section) => (
              <div key={section.heading} className="faq-section">
                <h2 className="faq-section-heading">{section.heading}</h2>
                {section.items.map((item) => (
                  <div key={item.q} className="faq-item">
                    <p className="faq-question">{item.q}</p>
                    <p className="faq-answer">{item.a}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
