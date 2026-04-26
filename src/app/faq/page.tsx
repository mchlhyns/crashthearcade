'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import { restoreSession, signOut } from '@/lib/atproto'
import HeaderMenu from '@/components/HeaderMenu'
import MobileMenu from '@/components/MobileMenu'

type Section = { heading: string; items: { q: string; a: ReactNode }[] }

const sections: Section[] = [
  {
    heading: 'Authentication',
    items: [
      {
        q: 'How do I sign in?',
        a: <>You sign in with your <a href="https://atmosphereaccount.com/" target="_blank">Atmosphere Account</a>. This is the same one you use for Bluesky, Blacksky, Eurosky, or any of the other sites that support the AT Protocol.</>,
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
      {
        q: 'Can I delete my CRASH THE ARCADE account?',
        a: <>You bet. Just head over to <a href="/settings">Settings</a> and you'll find the option at the bottom of the page. This will permanently delete all your games, lists, follows, and settings. Your Atmosphere Account won't be affected.</>,
      },
    ],
  },
  {
    heading: 'Privacy',
    items: [
      {
        q: 'Are my games, collections, and lists public?',
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
  const [userHandle, setUserHandle] = useState<string | null>(null)
  const [did, setDid] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

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

  function handleSignOut() {
    if (did) signOut(did).finally(() => { window.location.href = '/' })
    else window.location.href = '/'
  }

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
            <h1>FAQ</h1>
          </div>

          <div className="faq-section-container">
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
