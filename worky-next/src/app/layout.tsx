import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: "XNRGY Site Intelligence",
  description: "Notes-first project and site operations workspace",
  icons: {
    icon: '/brand/xnrgy-mark.svg',
    apple: '/brand/xnrgy-mark.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
