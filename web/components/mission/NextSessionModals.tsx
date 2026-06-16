'use client'

// Les 3 modales partagées (ajout / édition / création de course), pilotées par
// l'état renvoyé par useTodaySession. Mêmes composants qu'en mode expert.

import { SessionAddSheet } from '@/components/plan/SessionAddSheet'
import { SessionEditorModal } from '@/components/plan/SessionEditorModal'
import { RaceEditorModal } from '@/components/plan/RaceEditorModal'
import type { NextSessionModalsState } from './useTodaySession'

export function NextSessionModals({ state }: { state: NextSessionModalsState }) {
  return (
    <>
      <SessionAddSheet
        open={state.add.open} dateISO={state.add.dateISO} onClose={state.add.onClose}
        onPickTemplate={state.add.onPickTemplate} onCreateBlank={state.add.onCreateBlank}
      />
      <SessionEditorModal
        session={state.editor.session} initialDate={state.editor.initialDate} open={state.editor.open}
        prefillTemplate={state.editor.prefillTemplate} onClose={state.editor.onClose} onSaved={state.editor.onSaved}
      />
      <RaceEditorModal race={null} open={state.race.open} onClose={state.race.onClose} onSaved={state.race.onSaved} />
    </>
  )
}
