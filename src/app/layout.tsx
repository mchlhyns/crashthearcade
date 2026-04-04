import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Minimap',
  description: 'Track your video game backlog on the AT Protocol',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
