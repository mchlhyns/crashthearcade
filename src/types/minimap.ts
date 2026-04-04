export type GameStatus =
  | 'backlogged'
  | 'started'
  | 'shelved'
  | 'finished'
  | 'abandoned'
  | 'wishlist'

export interface GameRef {
  igdbId: number
  title: string
  coverUrl?: string
  igdbUrl?: string
}

export interface MinimapGameRecord {
  $type: 'app.minimap.game'
  game: GameRef
  status: GameStatus
  platform?: string
  rating?: number
  notes?: string
  startedAt?: string
  finishedAt?: string
  replay?: { uri: string; cid: string }
  createdAt: string
}

export interface GameRecordView {
  uri: string
  cid: string
  value: MinimapGameRecord
}

export interface IgdbGame {
  id: number
  name: string
  url?: string
  cover?: { url: string }
  first_release_date?: number
  platforms?: { name: string }[]
  summary?: string
}
