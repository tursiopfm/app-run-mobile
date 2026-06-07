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
  metadataBase: new URL('https://trailcockpit.run'),
  title: 'Trail Cockpit',
  description: 'Le centre de contrôle intelligent des sportifs d’endurance.',
  manifest: '/manifest.json',
  applicationName: 'Trail Cockpit',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Trail Cockpit',
  },
  icons: {
    // ?v=2 : bump des URLs après changement de logo → force la redétection
    // (favicon navigateur + régénération WebAPK Android/desktop). Voir manifest.json.
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Trail Cockpit',
    title: 'Trail Cockpit',
    description: 'Préparer. Piloter. Accomplir. — le centre de contrôle intelligent des sportifs d’endurance.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Trail Cockpit' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trail Cockpit',
    description: 'Préparer. Piloter. Accomplir. — le centre de contrôle intelligent des sportifs d’endurance.',
    images: ['/og-default.png'],
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
