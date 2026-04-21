'use client'

import { useEffect, useRef } from 'react'

interface Props {
  bannerUrl?: string
  coverUrl?: string
  title: string
  subtitle?: string
}

export default function GamePageBanner({ bannerUrl, coverUrl, title, subtitle }: Props) {
  const bannerBgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      if (bannerBgRef.current) {
        bannerBgRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="game-detail-banner-block">
      {bannerUrl && (
        <div
          ref={bannerBgRef}
          className="game-detail-banner-bg"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        />
      )}
      <div className="container game-detail-banner-content">
        <div id="game-cover-wrap" style={{ position: 'relative', flexShrink: 0 }}>
          <img src={coverUrl ?? '/no-cover.png'} alt={title} className="game-detail-cover" />
        </div>
        <div className="game-detail-banner-info">
          <h1 className="game-detail-title">{title}</h1>
          {subtitle && <p className="game-detail-banner-sub">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
