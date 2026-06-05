import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { ServiceWorkerRegistrar } from '@/components/ui/ServiceWorkerRegistrar'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLang } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Trail Cockpit',
  description: 'Your trail running dashboard',
  manifest: '/manifest.json',
  applicationName: 'Trail Cockpit',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Trail Cockpit',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#FF7900',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getServerLang()
  return (
    <html lang={lang} suppressHydrationWarning className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-trail-bg text-trail-text min-h-screen">
        <I18nProvider initialLang={lang}>
          <ThemeProvider>
            {children}
            <ServiceWorkerRegistrar />
            <InstallPrompt />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
