'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useColors } from '@/lib/design/useColors'
import { type TrailPalette } from '@/lib/design/colors'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { LangChoice } from '@/lib/i18n'

type ThemeOption = 'Dark' | 'Light' | 'System'

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
  const { choice, setLang } = useLang()
  const t = useT()
  const colors = useColors()
  const router = useRouter()

  const themeOptions: { value: ThemeOption; nextTheme: string; label: string }[] = [
    { value: 'Dark',   nextTheme: 'dark',   label: t.settings.themeDark },
    { value: 'Light',  nextTheme: 'light',  label: t.settings.themeLight },
    { value: 'System', nextTheme: 'system', label: t.settings.themeSystem },
  ]

  const langOptions: { value: LangChoice; label: string }[] = [
    { value: 'fr',     label: t.settings.langFrench },
    { value: 'en',     label: t.settings.langEnglish },
    { value: 'system', label: t.settings.langSystem },
  ]

  const themeDesc: Record<ThemeOption, string> = {
    Dark:   t.settings.themeDescDark,
    Light:  t.settings.themeDescLight,
    System: t.settings.themeDescSystem,
  }

  function handleLang(newChoice: LangChoice) {
    setLang(newChoice)
    // Server components (e.g. settings/page.tsx) read the cookie at request time,
    // so we refresh the route to pick up the new language without a full reload.
    router.refresh()
  }

  const activeOption = themeOptions.find(o => o.nextTheme === theme) ?? themeOptions[0]
  const selectedLang = langOptions.find(l => l.value === choice) ?? langOptions[0]
  const langRowTitle = t.settings.languageRow

  return (
    <>
      {/* Theme chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {themeOptions.map(opt => (
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
        {themeDesc[activeOption.value]}
      </p>

      {/* Language row + chips */}
      <div className="mt-[14px] space-y-2">
        <SettingsRow
          title={langRowTitle}
          value={selectedLang.label}
          accent={colors.seriesBlue}
          colors={colors}
        />
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {langOptions.map(opt => (
            <ActionChip
              key={opt.value}
              label={opt.label}
              active={choice === opt.value}
              onClick={() => handleLang(opt.value)}
              colors={colors}
            />
          ))}
        </div>
      </div>
    </>
  )
}
