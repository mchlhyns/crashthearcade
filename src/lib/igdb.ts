import { IgdbGame } from '@/types/minimap'

export function normalizeCoverUrl(url: string): string {
  // IGDB returns URLs like //images.igdb.com/igdb/image/upload/t_thumb/...
  // We want t_cover_big for better quality
  return url
    .replace(/^\/\//, 'https://')
    .replace('/t_thumb/', '/t_cover_big/')
}

export function formatIgdbGame(game: IgdbGame): IgdbGame & { coverUrl?: string } {
  return {
    ...game,
    coverUrl: game.cover ? normalizeCoverUrl(game.cover.url) : undefined,
  }
}
