'use client'

import { useState } from 'react'

interface Props {
  text: string
  children: React.ReactNode
}

export default function Tooltip({ text, children }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="tooltip-trigger">{children}</span>
      {visible && <span className="tooltip-popover">{text}</span>}
    </span>
  )
}
