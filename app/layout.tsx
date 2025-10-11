import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ATLAS Directive',
  description: 'Interactive Narrative Discovery Platform for 3I/ATLAS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
