import type { Metadata } from 'next'
import { getGame } from '@/lib/igdb-game'
import { normalizeCoverUrl } from '@/lib/igdb'

interface Props {
  params: Promise<{ igdbId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { igdbId } = await params
  const id = Number(igdbId)
  if (!Number.isFinite(id) || id <= 0) return {}

  const game = await getGame(id)
  if (!game) return {}

  const title = game.name
  const description = game.summary?.slice(0, 160) ?? `${game.name} on CRASH THE ARCADE`
  const coverUrl = game.cover ? normalizeCoverUrl(game.cover.url) : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://crashthearcade.com/games/${igdbId}`,
      images: [{ url: coverUrl ?? '/og-image-thumb.png' }],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [coverUrl ?? '/og-image-thumb.png'],
    },
  }
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children
}
