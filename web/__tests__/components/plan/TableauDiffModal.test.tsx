import { render, screen, fireEvent } from '@testing-library/react'
import { TableauDiffModal } from '@/components/plan/TableauDiffModal'

const wp = (over: any = {}) => ({ orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over })
const pd: any = {
  kind: 'changed', detectedAt: 'T',
  newWaypoints: [wp({ name: 'Départ' }), wp({ name: 'Col', km: 50, cutoffRaw: 'sam. 11:00' }), wp({ name: 'Arrivée', km: 100 })],
  newMeta: { editionYear: 2026, editionDate: null, dateExplicit: false, freshnessStatus: 'confirmed', sourceHash: 'NEW' },
  summary: { added: 1, removed: 0, modified: 1, modifiedDetails: [] },
}
const current = [wp({ name: 'Départ' }), wp({ name: 'Col', km: 50, cutoffRaw: 'sam. 10:00' }), wp({ name: 'Arrivée', km: 100 })]

it('rend le diff et déclenche apply/dismiss', () => {
  const onApply = jest.fn(); const onDismiss = jest.fn()
  render(<TableauDiffModal currentWaypoints={current as any} pendingDiff={pd} busy={false} onApply={onApply} onDismiss={onDismiss} onClose={() => {}} />)
  expect(screen.getByText(/mis à jour/i)).toBeInTheDocument()
  expect(screen.getByText(/barrière/i)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Appliquer le nouveau tableau')); expect(onApply).toHaveBeenCalled()
  fireEvent.click(screen.getByText(/Garder l/)); expect(onDismiss).toHaveBeenCalled()
})
