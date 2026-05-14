'use client'

import { useEffect, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

const SHOW_DELAY_MS = 2500

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return Boolean(mq || iosStandalone)
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIos && isSafari
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [showIosInstructions, setShowIosInstructions] = useState(false)
  const [iosMode, setIosMode] = useState(false)

  useEffect(() => {
    if (isStandalone()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    }
    const onInstalled = () => { setVisible(false); setDeferred(null) }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    let iosTimer: number | undefined
    if (isIosSafari()) {
      setIosMode(true)
      iosTimer = window.setTimeout(() => {
        setVisible(true)
        setShowIosInstructions(true)
      }, SHOW_DELAY_MS)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (iosTimer) window.clearTimeout(iosTimer)
    }
  }, [])

  if (!visible) return null

  const handleInstall = async () => {
    if (iosMode) { setShowIosInstructions(true); return }
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null); setVisible(false)
    } catch { setVisible(false) }
  }

  const handleDismiss = () => { setVisible(false); setShowIosInstructions(false) }

  if (showIosInstructions) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Installer Trail Cockpit"
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-safe">
        <div className="w-full max-w-md bg-trail-card border border-trail-border rounded-2xl p-5 shadow-2xl">
          <div className="flex items-start gap-3 mb-4">
            <img src="/icons/icon-192.png" alt="" aria-hidden="true" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1">
              <h2 className="text-trail-text font-semibold text-base">Installer Trail Cockpit</h2>
              <p className="text-trail-muted text-13 mt-0.5">Ajoute l&apos;app à ton écran d&apos;accueil</p>
            </div>
            <button onClick={handleDismiss} aria-label="Fermer" className="text-trail-muted hover:text-trail-text p-1 -m-1">
              <X size={18} />
            </button>
          </div>
          <ol className="space-y-3">
            <li className="flex items-center gap-3 bg-trail-surface border border-trail-border rounded-xl p-3">
              <span className="w-6 h-6 rounded-full bg-trail-primary/20 text-trail-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <span className="text-trail-text text-sm flex-1">Appuie sur l&apos;icône Partager</span>
              <Share className="text-trail-accent shrink-0" size={20} />
            </li>
            <li className="flex items-center gap-3 bg-trail-surface border border-trail-border rounded-xl p-3">
              <span className="w-6 h-6 rounded-full bg-trail-primary/20 text-trail-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <span className="text-trail-text text-sm flex-1">
                Choisis <span className="font-semibold">« Sur l&apos;écran d&apos;accueil »</span>
              </span>
              <Plus className="text-trail-accent shrink-0" size={20} />
            </li>
            <li className="flex items-center gap-3 bg-trail-surface border border-trail-border rounded-xl p-3">
              <span className="w-6 h-6 rounded-full bg-trail-primary/20 text-trail-primary text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <span className="text-trail-text text-sm flex-1">Confirme avec « Ajouter »</span>
            </li>
          </ol>
          <button onClick={handleDismiss}
            className="mt-4 w-full py-3 rounded-xl bg-trail-primary text-white font-semibold text-sm active:scale-[0.98] transition-transform">
            J&apos;ai compris
          </button>
        </div>
      </div>
    )
  }

  return (
    <div role="dialog" aria-label="Installer Trail Cockpit"
      className="fixed left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-[60] pb-safe">
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 shadow-2xl flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" aria-hidden="true" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-trail-text font-semibold text-sm leading-tight">Installer Trail Cockpit</p>
          <p className="text-trail-muted text-xs mt-0.5 leading-snug">Accès rapide depuis ton écran d&apos;accueil</p>
        </div>
        <button onClick={handleInstall}
          className="shrink-0 inline-flex items-center gap-1.5 py-2 px-3 rounded-xl bg-trail-primary text-white font-semibold text-sm active:scale-95 transition-transform">
          <Download size={16} />
          Installer
        </button>
        <button onClick={handleDismiss} aria-label="Plus tard" className="shrink-0 text-trail-muted hover:text-trail-text p-1 -m-1">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
