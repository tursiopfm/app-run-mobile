import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bike,
  ChevronRight,
  FileText,
  Footprints,
  Info,
  LineChart,
  LifeBuoy,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { ContactCard } from '@/components/support/ContactCard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support — Trail Cockpit',
  description:
    'Support et informations pour les utilisateurs de Trail Cockpit connectés à Strava.',
}

type Feature = {
  icon: typeof Activity
  label: string
}

const FEATURES: Feature[] = [
  { icon: Activity,   label: 'Synchronisation des activités Strava' },
  { icon: BarChart3,  label: 'Tableaux de bord de charge d’entraînement' },
  { icon: LineChart,  label: 'Analyse personnalisée des performances' },
  { icon: Footprints, label: 'Suivi des activités running, trail et vélo' },
]

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Activity
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-[10px] px-1 mb-[10px]">
      <div className="w-7 h-7 rounded-[8px] bg-trail-surface border border-trail-border flex items-center justify-center flex-shrink-0">
        <Icon size={14} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-trail-text leading-tight">{title}</p>
        <p className="text-[11px] text-trail-muted leading-tight mt-[1px]">{subtitle}</p>
      </div>
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-trail-card border border-trail-border p-[10px] space-y-[10px]">
      {children}
    </div>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-trail-muted">
          {label}
        </p>
        <p className="text-[13px] text-trail-text mt-[2px]">{value}</p>
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-trail-bg">
      <div className="px-3 py-3 pb-10 space-y-4 max-w-lg mx-auto">

        {/* ── Back link (only useful when navigated from within the app) ── */}
        <div className="pt-[2px]">
          <Link
            href="/settings"
            className="inline-flex items-center gap-[6px] text-[12px] text-trail-muted hover:text-trail-text transition-colors"
          >
            <ArrowLeft size={14} />
            Retour aux réglages
          </Link>
        </div>

        {/* ── Page hero ── */}
        <header className="px-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-trail-primary">
            Support
          </p>
          <h1 className="text-[22px] font-black text-trail-text leading-tight mt-[2px]">
            Trail Cockpit Support
          </h1>
          <p className="text-[12px] text-trail-muted leading-[16px] mt-[6px] max-w-[400px]">
            Support et informations pour les utilisateurs de Trail Cockpit connectés à Strava.
          </p>
        </header>

        {/* ── Contact ── */}
        <section>
          <SectionHeader
            icon={LifeBuoy}
            title="Contact"
            subtitle="Une question, un bug, une suggestion ?"
          />
          <SectionCard>
            <ContactCard />
            <p className="text-[11px] text-trail-muted leading-[16px] px-1">
              Nous répondons généralement sous 48 h ouvrées. Merci d’indiquer
              ton compte Strava (prénom + nom) si la demande concerne la
              synchronisation de tes activités.
            </p>
          </SectionCard>
        </section>

        {/* ── Fonctionnalités ── */}
        <section>
          <SectionHeader
            icon={BarChart3}
            title="Fonctionnalités"
            subtitle="Ce que Trail Cockpit fait avec tes données"
          />
          <SectionCard>
            <ul className="space-y-[6px]">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface"
                >
                  <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className="text-trail-primary" />
                  </div>
                  <p className="flex-1 text-[13px] text-trail-text">{label}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        {/* ── Connexion Strava ── */}
        <section>
          <SectionHeader
            icon={Bike}
            title="Connexion Strava"
            subtitle="Comment ton compte Strava est utilisé"
          />
          <SectionCard>
            <div className="rounded-[10px] bg-trail-surface px-3 py-[12px] space-y-[10px]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#FC4C02]/15 border border-[#FC4C02]/30 flex items-center justify-center flex-shrink-0">
                  <Activity size={14} className="text-[#FC4C02]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-trail-muted">
                    Authentification
                  </p>
                  <p className="text-[13px] text-trail-text">Strava OAuth sécurisé</p>
                </div>
              </div>
              <p className="text-[12px] text-trail-text leading-[18px] px-1">
                Les utilisateurs se connectent de manière sécurisée via Strava
                OAuth. Les utilisateurs peuvent déconnecter leur compte Strava à
                tout moment depuis les réglages de l’application.
              </p>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-card border border-trail-border hover:bg-trail-border/30 transition-colors"
              >
                <p className="flex-1 text-[12px] font-semibold text-trail-text">
                  Gérer la connexion Strava
                </p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
            </div>
          </SectionCard>
        </section>

        {/* ── Réglementaire ── */}
        <section>
          <SectionHeader
            icon={Scale}
            title="Réglementaire"
            subtitle="Mentions légales, confidentialité et conditions"
          />
          <SectionCard>
            <div className="rounded-[10px] bg-trail-surface divide-y divide-trail-border">
              <Link
                href="/legal/mentions-legales"
                className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-trail-primary" />
                </div>
                <p className="flex-1 text-[13px] text-trail-text">Mentions légales</p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
              <Link
                href="/legal/confidentialite"
                className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={13} className="text-trail-primary" />
                </div>
                <p className="flex-1 text-[13px] text-trail-text">Politique de confidentialité</p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
              <Link
                href="/legal/conditions-utilisation"
                className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                  <Scale size={13} className="text-trail-primary" />
                </div>
                <p className="flex-1 text-[13px] text-trail-text">Conditions d’utilisation</p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
            </div>
            <p className="text-[11px] text-trail-muted leading-[16px] px-1">
              Trail Cockpit stocke uniquement les données nécessaires à
              l’analyse de tes activités (activités Strava, profil athlète,
              préférences d’interface). Tu peux demander la suppression de
              l’ensemble de tes données via la section Contact.
            </p>
          </SectionCard>
        </section>

        {/* ── À propos ── */}
        <section>
          <SectionHeader
            icon={Info}
            title="À propos"
            subtitle="L’application Trail Cockpit"
          />
          <SectionCard>
            <div className="space-y-[6px]">
              <AboutRow label="Nom de l’application" value="Trail Cockpit" />
              <AboutRow
                label="Type"
                value="Tableau de bord sportif et compagnon d’entraînement"
              />
              <AboutRow label="Plateformes" value="Web · PWA (iOS, Android, desktop)" />
              <AboutRow label="Intégration" value="Compatible avec Strava" />
            </div>
          </SectionCard>
        </section>

        {/* ── Mention Strava (compliance) ── */}
        <section className="px-1 pt-2">
          <div className="rounded-[10px] bg-trail-surface border border-trail-border px-3 py-[12px] space-y-[6px]">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-[#FC4C02] flex-shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-trail-text">
                Powered by Strava
              </p>
            </div>
            <p className="text-[11px] text-trail-muted leading-[16px]">
              Trail Cockpit est une application indépendante. Elle utilise l’API
              Strava pour synchroniser tes activités mais n’est ni développée,
              ni sponsorisée, ni affiliée à Strava. Strava et le logo Strava
              sont des marques déposées de Strava, Inc.
            </p>
          </div>
        </section>

        {/* ── Footer signature ── */}
        <p className="text-center text-[10px] text-trail-muted/70 tracking-wider uppercase pt-2">
          Trail Cockpit · Conçu pour les coureurs de trail
        </p>

      </div>
    </div>
  )
}
