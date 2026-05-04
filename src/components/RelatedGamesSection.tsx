interface RelatedGame {
  id: number
  name: string
  coverUrl?: string
}

interface Props {
  games: RelatedGame[]
}

export default function RelatedGamesSection({ games }: Props) {
  return (
    <div className="game-detail-related-grid">
      {games.map(game => (
        <div key={game.id} className="browse-card">
          <div className="browse-card-cover-wrap">
            <a href={`/games/${game.id}`} style={{ display: 'block', lineHeight: 0 }}>
              <img className="browse-card-cover" src={game.coverUrl ?? '/no-cover.png'} alt={game.name} />
            </a>
          </div>
          <div className="browse-card-title">
            <a href={`/games/${game.id}`}>{game.name}</a>
          </div>
        </div>
      ))}
    </div>
  )
}
