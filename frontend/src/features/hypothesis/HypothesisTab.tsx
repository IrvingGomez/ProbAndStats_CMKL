import type { HypothesisResponse } from '../../api/hypothesis'
import HypothesisControls from './HypothesisControls'
import HypothesisObservation from './HypothesisObservation'
import HypothesisNotebook from './HypothesisNotebook'
import type { HypothesisConfig } from './useHypothesisTabState'

interface SlotProps {
  result: HypothesisResponse | null
  hasData: boolean
  isComputing: boolean
  precision: number
  error: string | null
  revealed: boolean
  onReveal: () => void
  onRun: (cfg: HypothesisConfig) => void
  onLiveChange: (cfg: HypothesisConfig) => void
  onReset: () => void
}

export function ControlsSlot({ onRun, onLiveChange, onReset, isComputing, error }: Pick<SlotProps, 'onRun' | 'onLiveChange' | 'onReset' | 'isComputing' | 'error'>) {
  return <HypothesisControls onRun={onRun} onLiveChange={onLiveChange} onReset={onReset} isComputing={isComputing} error={error} />
}

export function ObservationSlot({ result, hasData, isComputing, revealed, onReveal }: Pick<SlotProps, 'result' | 'hasData' | 'isComputing' | 'revealed' | 'onReveal'>) {
  return (
    <div className="h-full relative">
      <HypothesisObservation result={result} hasData={hasData} isComputing={isComputing} revealed={revealed} onReveal={onReveal} />
      {isComputing && (
        <div className="absolute inset-0 bg-[var(--color-bg-base)]/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-4 py-2 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
            <span className="animate-spin text-lg">⚙️</span> Running Test...
          </div>
        </div>
      )}
    </div>
  )
}

export function NotebookSlot({ result, precision, revealed, onReveal }: Pick<SlotProps, 'result' | 'precision' | 'revealed' | 'onReveal'>) {
  return <HypothesisNotebook result={result} precision={precision} revealed={revealed} onReveal={onReveal} />
}
