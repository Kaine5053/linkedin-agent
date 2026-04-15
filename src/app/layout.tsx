import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/shared/Toast'

export const metadata: Metadata = {
  title: 'LinkedIn Agent — UK Civil Engineering',
  description: 'AI-powered LinkedIn outreach dashboard for civil engineering professionals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
