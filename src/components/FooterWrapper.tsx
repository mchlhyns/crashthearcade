'use client'

import dynamic from 'next/dynamic'

const SiteFooter = dynamic(() => import('@/components/FooterLinks'), { ssr: false })

export default function FooterWrapper() {
  return <SiteFooter />
}
