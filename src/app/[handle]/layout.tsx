import type { Metadata } from 'next'

interface Props {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const clean = handle.replace(/^@/, '')
  const title = `@${clean}`
  const description = `Check out @${clean}'s game collection on CRASH THE ARCADE. Track your games, in the Atmosphere.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://crashthearcade.com/${clean}`,
      images: [{ url: '/og-image-thumb.png' }],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: ['/og-image-thumb.png'],
    },
  }
}

export default function HandleLayout({ children }: { children: React.ReactNode }) {
  return children
}
