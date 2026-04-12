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
  releaseYear?: number
  releaseDate?: number
}

export interface GameRecord {
  $type: 'app.crashthearcade.game'
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
  value: GameRecord
}

export interface ListItem {
  igdbId: number
  title: string
  coverUrl?: string
  position: number
  award?: string
}

export interface ListRecord {
  $type: 'app.crashthearcade.list'
  name: string
  items: ListItem[]
  createdAt: string
  updatedAt: string
}

export interface ListRecordView {
  uri: string
  cid: string
  value: ListRecord
}

export interface IgdbGame {
  id: number
  name: string
  url?: string
  cover?: { url: string }
  first_release_date?: number
  platforms?: { name: string }[]
  summary?: string
  rating?: number
  rating_count?: number
  hypes?: number
}
