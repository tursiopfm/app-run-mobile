'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { useColors } from '@/lib/design/useColors'
import { type TrailPalette } from '@/lib/design/colors'
import { settings as settingsLabels } from '@/lib/design/labels'

type ThemeOption = 'Dark' | 'Light' | 'System'
type Lang  = 'fr' | 'en' | 'system'

const THEME_OPTIONS: { value: ThemeOption; nextTheme: string; label: string }[] = [
  { value: 'Dark',   nextTheme: 'dark',   label: settingsLabels.themeDark },
  { value: 'Light',  nextTheme: 'light',  label: settingsLabels.themeLight },
  { value: 'System', nextTheme: 'system', label: settingsLabels.themeSystem },
]

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'fr',     label: settingsLabels.langFrench },
  { value: 'en',     label: settingsLabels.langEnglish },
  { value: 'system', label: settingsLabels.langSystem },
]

const THEME_DESC: Record<ThemeOption, string> = {
  Dark:   'Interface sombre optimisée pour la lecture en extérieur.',
  Light:  'Interface claire adaptée aux environnements bien éclairés.',
  System: "Suit automatiquement le réglage système de l'appareil.",
}

function ActionChip({
  label, active, onClick, colors,
}: {
  label: string; active: boolean; onClick: () => void; colors: TrailPalette
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full px-3 py-[6px] border text-[12px] font-semibold"
      style={{
        backgroundColor: active ? `${colors.chargeOrange}2B` : colors.surface,
        borderColor:     active ? colors.chargeOrange : colors.border,
        color:           active ? colors.chargeOrange : colors.subtleText,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function SettingsRow({
  title, value, accent, colors,
}: {
  title: string; value: string; accent: string; colors: TrailPalette
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[12px]"
      style={{ padding: '10px 12px', backgroundColor: colors.surface }}
    >
      <span className="text-[14px] text-trail-muted">{title}</span>
      <span className="text-[14px] font-semibold" style={{ color: accent }}>{value}</span>
    </div>
  )
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const [lang, setLang] = useState<Lang>('fr')
  const colors = useColors()

  const activeOption = THEME_OPTIONS.find(o => o.nextTheme === theme) ?? THEME_OPTIONS[0]
  const selectedLang = LANG_OPTIONS.find(l => l.value === lang)!

  return (
    <>
      {/* Theme chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {THEME_OPTIONS.map(opt => (
          <ActionChip
            key={opt.value}
            label={opt.label}
            active={activeOption.value === opt.value}
            onClick={() => setTheme(opt.nextTheme)}
            colors={colors}
          />
        ))}
      </div>
      <p className="text-[11px] text-trail-muted leading-[16px] mt-[10px]">
        {THEME_DESC[activeOption.value]}
      </p>

      {/* Language row + chips */}
      <div className="mt-[14px] space-y-2">
        <SettingsRow
          title="Langue"
          value={selectedLang.label}
          accent={colors.seriesBlue}
          colors={colors}
        />
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {LANG_OPTIONS.map(opt => (
            <ActionChip
              key={opt.value}
              label={opt.label}
              active={lang === opt.value}
              onClick={() => setLang(opt.value)}
              colors={colors}
            />
          ))}
        </div>
      </div>
    </>
  )
}
