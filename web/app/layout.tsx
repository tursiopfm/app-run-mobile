import type { Metadata, Viewport } from 'next'
import './globals.css'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { ServiceWorkerRegistrar } from '@/components/ui/ServiceWorkerRegistrar'

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
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-trail-bg text-trail-text min-h-screen">
        {children}
        <ServiceWorkerRegistrar />
        <InstallPrompt />
      </body>
    </html>
  )
}
