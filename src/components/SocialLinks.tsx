'use client'

import Tooltip from '@/components/Tooltip'

export interface SocialLinksData {
  steam?: string
  psn?: string
  xbox?: string
  nintendo?: string
  battlenet?: string
  itchio?: string
}

const PLATFORM_CONFIG: {
  key: keyof SocialLinksData
  icon: string
  url: ((v: string) => string) | null
  title: (v: string) => string
}[] = [
  {
    key: 'steam',
    icon: '/icons/steam.svg',
    url: (v) => `https://store.steampowered.com/id/${encodeURIComponent(v)}`,
    title: (v) => `Steam: ${v}`,
  },
  {
    key: 'psn',
    icon: '/icons/playstation.svg',
    url: (v) => `https://psnprofiles.com/${encodeURIComponent(v)}`,
    title: (v) => `PSN: ${v}`,
  },
  {
    key: 'xbox',
    icon: '/icons/xbox.svg',
    url: (v) => `https://xboxgamertag.com/search/${encodeURIComponent(v)}`,
    title: (v) => `Xbox: ${v}`,
  },
  {
    key: 'nintendo',
    icon: '/icons/nintendo-switch.svg',
    url: null,
    title: (v) => `Nintendo: ${v}`,
  },
  {
    key: 'battlenet',
    icon: '/icons/battle-net.svg',
    url: null,
    title: (v) => `Battle.net: ${v}`,
  },
  {
    key: 'itchio',
    icon: '/icons/itch-io.svg',
    url: (v) => `https://${encodeURIComponent(v)}.itch.io`,
    title: (v) => `itch.io: ${v}`,
  },
]

export { PLATFORM_CONFIG }

export default function SocialLinks({ links }: { links: SocialLinksData }) {
  const entries = PLATFORM_CONFIG.filter(({ key }) => links[key])
  if (entries.length === 0) return null
  return (
    <div className="social-links">
      {entries.map(({ key, icon, url, title }) => {
        const value = links[key]!
        const href = url ? url(value) : undefined
        const titleText = title(value)
        if (href) {
          return (
            <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="social-link" title={titleText}>
              <img src={icon} alt="" width={18} height={18} />
            </a>
          )
        }
        return (
          <Tooltip key={key} text={titleText}>
            <span className="social-link">
              <img src={icon} alt="" width={18} height={18} />
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
