import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { CommandPalette } from '@/components/ui/command-palette'
import { SessionBoundary } from '@/components/providers/session-boundary'
import './globals.css'

const siteUrl = 'https://app.safemeds.uk'
const siteName = 'SafeMeds'
const siteDescription =
  'Pharmaceutical compliance and supply chain management, engineered for audit-grade security and traceability.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SafeMeds — The Pharmaceutical Compliance Standard',
    template: '%s · SafeMeds',
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName,
    title: 'SafeMeds — The Pharmaceutical Compliance Standard',
    description: siteDescription,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SafeMeds — The Pharmaceutical Compliance Standard',
    description: siteDescription,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f766e' },
    { media: '(prefers-color-scheme: dark)', color: '#14b8a6' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body className="antialiased font-sans bg-[var(--bg)] text-[var(--text)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionBoundary />
          <CommandPalette />
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
