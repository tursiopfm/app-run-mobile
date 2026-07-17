'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useColors } from '@/lib/design/useColors'
import { type TrailPalette } from '@/lib/design/colors'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { LangChoice } from '@/lib/i18n'
import { useMorningReportAutoOpen } from '@/lib/preferences/morning-report'

type ThemeOption = 'Dark' | 'Light' | 'System'

function ActionChip({
  label, active, onClick, colors,
}: {
  label: string; active: boolean; onClick: () => void; colors: TrailPalette
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full px-3 py-[6px] border text-caption font-semibold"
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

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const { choice, setLang } = useLang()
  const t = useT()
  const colors = useColors()
  const router = useRouter()
  const morningReport = useMorningReportAutoOpen()

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
      <p className="text-micro text-trail-muted leading-[16px] mt-[10px]">
        {themeDesc[activeOption.value]}
      </p>

      {/* Language chips */}
      <div className="mt-[14px] flex gap-2 overflow-x-auto pb-0.5">
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

      {/* Rapport matinal — auto-ouverture */}
      <div className="mt-[14px] flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-caption font-semibold text-trail-text leading-tight">
            {t.settings.morningReportAutoOpenLabel}
          </p>
          <p className="text-micro text-trail-muted leading-[15px] mt-[2px]">
            {t.settings.morningReportAutoOpenHint}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={morningReport.enabled}
          aria-label={t.settings.morningReportAutoOpenLabel}
          onClick={() => morningReport.setEnabled(!morningReport.enabled)}
          className={
            'relative inline-flex flex-shrink-0 h-[22px] w-[40px] items-center rounded-full transition-colors ' +
            (morningReport.enabled ? 'bg-trail-primary' : 'bg-trail-border')
          }
          style={{ visibility: morningReport.mounted ? 'visible' : 'hidden' }}
        >
          <span
            className={
              'inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ' +
              (morningReport.enabled ? 'translate-x-[20px]' : 'translate-x-[2px]')
            }
          />
        </button>
      </div>
    </>
  )
}
