'use client'

import { usePathname } from 'next/navigation'

const links = [
  { label: 'FAQ', href: '/faq' },
  { label: 'Feedback', href: '/feedback' },
  { label: 'Roadmap', href: 'https://skyboard.dev/board/did:plc:crwol3wvv2w2lvvognhvd5cm/3mkdcspo57s2u', external: true },
  { label: 'Bluesky', href: 'https://bsky.app/profile/crashthearcade.com', external: true },
  { label: 'GitHub', href: 'https://github.com/mchlhyns/crashthearcade', external: true },
]

export default function SiteFooter() {
  const pathname = usePathname()

  return (
    <footer>
      <div className="container">
        <div className="footer-wordmark">
          CRASH THE ARCADE ©2026
        </div>
        <nav className="footer-links">
          {links.map(({ label, href, external }) => (
            <a
              key={href}
              href={href}
              className={pathname === href ? 'footer-link-active' : ''}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
