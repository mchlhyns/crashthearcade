import type { Metadata } from 'next'
import './globals.css'

const APP_URL = 'https://crashthearcade.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'CRASH THE ARCADE',
    template: '%s · CRASH THE ARCADE',
  },
  description: 'Track your games, in the ATmosphere.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    siteName: 'CRASH THE ARCADE',
    title: 'CRASH THE ARCADE',
    description: 'Track your games, in the ATmosphere.',
    url: APP_URL,
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CRASH THE ARCADE' }],
  },
  twitter: {
    card: 'summary',
    title: 'CRASH THE ARCADE',
    description: 'Track your games, in the ATmosphere.',
    images: ['/og-image-thumb.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
