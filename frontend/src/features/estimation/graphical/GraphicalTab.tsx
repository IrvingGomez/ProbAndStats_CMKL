import type { GraphicalResponse } from '../../../api/graphical'
import GraphicalControls from './GraphicalControls'
import GraphicalObservation from './GraphicalObservation'
import GraphicalNotebook from './GraphicalNotebook'
import type { GraphicalConfig } from './graphicalState'

interface SlotProps {
  result: GraphicalResponse | null
  column: string
  graphType: string
  hasData: boolean
  isComputing: boolean
  isDirty: boolean
  staleOverlays: string[]
  error: string | null
  precision: number
  onLive: (cfg: GraphicalConfig) => void
  onRun: (cfg: GraphicalConfig) => void
  onReset: () => void
}

export function ControlsSlot({
  onLive, onRun, onReset, isComputing, isDirty,
}: Pick<SlotProps, 'onLive' | 'onRun' | 'onReset' | 'isComputing' | 'isDirty'>) {
  return (
    <GraphicalControls
      onLive={onLive}
      onRun={onRun}
      onReset={onReset}
      isComputing={isComputing}
      isDirty={isDirty}
    />
  )
}

export function ObservationSlot({
  result, column, graphType, hasData, isComputing, staleOverlays, error,
}: Pick<SlotProps, 'result' | 'column' | 'graphType' | 'hasData' | 'isComputing' | 'staleOverlays' | 'error'>) {
  return (
    <div className="h-full relative">
      <GraphicalObservation
        result={result}
        column={column}
        graphType={graphType}
        hasData={hasData}
        isComputing={isComputing}
        staleOverlays={staleOverlays}
        error={error}
      />
      {isComputing && (
        <div className="absolute inset-0 bg-[var(--color-bg-base)]/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-4 py-2 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
            <span className="animate-spin text-lg">⚙️</span> Drawing plot...
          </div>
        </div>
      )}
    </div>
  )
}

export function NotebookSlot({
  result, column, graphType, precision, staleOverlays,
}: Pick<SlotProps, 'result' | 'column' | 'graphType' | 'precision' | 'staleOverlays'>) {
  return (
    <GraphicalNotebook
      result={result}
      column={column}
      graphType={graphType}
      precision={precision}
      staleOverlays={staleOverlays}
    />
  )
}
