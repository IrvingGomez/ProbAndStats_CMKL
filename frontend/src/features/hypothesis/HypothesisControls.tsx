import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import DualInput from '../../components/DualInput';
import GroupBuilder from './GroupBuilder';
import {
  EQUAL_VARIANCE,
  ONE_SAMPLE_T,
  ONE_WAY_ANOVA,
  TEST_TYPES,
  TWO_SAMPLE_T,
  type Alternative,
  type GroupSpec,
} from '../../api/hypothesis';
import { DEFAULT_CONFIG, type HypothesisConfig } from './useHypothesisTabState';

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 mt-2">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="border-t border-[var(--color-border)] my-3" />
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-[var(--color-text-muted)]">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md px-2.5 py-1.5 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-md)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] cursor-pointer">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-[var(--color-text-muted)]">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-md px-2.5 py-1.5 text-xs font-mono bg-[var(--color-bg-input)] border border-[var(--color-border-md)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
      {hint && <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mb-3">
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative w-8 h-4 rounded-full transition-colors ${value ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-md)]'}`}>
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-xs text-[var(--color-text)]">{label}</span>
    </label>
  )
}

const ALTERNATIVES: { value: Alternative; label: string }[] = [
  { value: 'two-sided', label: '≠' },
  { value: 'greater', label: '>' },
  { value: 'less', label: '<' },
];

function AlternativeRadio({ value, onChange }: { value: Alternative; onChange: (v: Alternative) => void }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-[var(--color-text-muted)]">Alternative H₁</label>
      <div className="flex gap-1">
        {ALTERNATIVES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => onChange(a.value)}
            className={`flex-1 py-1.5 rounded-md text-xs font-mono border transition-colors cursor-pointer ${
              value === a.value
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-input)] text-[var(--color-text)] border-[var(--color-border-md)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const emptyGroup = (name: string): GroupSpec => ({ column: '', values: [], name });

export default function HypothesisControls({
  onRun,
  onLiveChange,
  onReset,
  isComputing,
  error,
}: {
  onRun: (cfg: HypothesisConfig) => void;
  onLiveChange: (cfg: HypothesisConfig) => void;
  onReset: () => void;
  isComputing: boolean;
  error: string | null;
}) {
  const { state } = useData();
  const hasData = state.status === 'ready' && state.numericCols.length > 0;

  const [column, setColumn] = useState(state.numericCols[0] ?? '');
  const [testType, setTestType] = useState<string>(ONE_SAMPLE_T);
  const [alpha, setAlpha] = useState(0.05);
  const [alternative, setAlternative] = useState<Alternative>('two-sided');
  const [mu0Str, setMu0Str] = useState('');
  const [correction, setCorrection] = useState(true);
  const [varianceTestType, setVarianceTestType] = useState('Levene');
  const [group1, setGroup1] = useState<GroupSpec>(emptyGroup('Group 1'));
  const [group2, setGroup2] = useState<GroupSpec>(emptyGroup('Group 2'));
  const [anovaGroup, setAnovaGroup] = useState<GroupSpec>(emptyGroup('Groups'));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!column && state.numericCols.length > 0) setColumn(state.numericCols[0]);
  }, [state.numericCols, column]);

  const needsGroups = testType === TWO_SAMPLE_T || testType === EQUAL_VARIANCE;
  const isAnova = testType === ONE_WAY_ANOVA;
  const isOneSample = testType === ONE_SAMPLE_T;
  // Bartlett, Levene and ANOVA reject in the upper tail whatever the radio says,
  // so the radio is hidden for them — as it is in the original app.
  const showAlternative = isOneSample || testType === TWO_SAMPLE_T;

  const buildConfig = useCallback((): HypothesisConfig | null => {
    if (!column) { setLocalError('Select a numeric variable.'); return null; }

    let mu0: number | null = null;
    if (isOneSample) {
      if (mu0Str.trim() === '') { setLocalError('μ₀ must be specified for the one-sample t-test.'); return null; }
      mu0 = Number(mu0Str);
      if (Number.isNaN(mu0)) { setLocalError('μ₀ must be a numeric value.'); return null; }
    }
    if (needsGroups && (group1.values.length === 0 || group2.values.length === 0)) {
      setLocalError('Both groups need at least one category selected.'); return null;
    }
    if (isAnova && anovaGroup.values.length < 2) {
      setLocalError('Select at least two categories for ANOVA.'); return null;
    }

    setLocalError(null);
    return {
      ...DEFAULT_CONFIG,
      column,
      testType,
      alpha,
      alternative,
      mu0,
      correction,
      varianceTestType,
      group1: needsGroups ? group1 : null,
      group2: needsGroups ? group2 : null,
      anovaColumn: isAnova ? anovaGroup.column : null,
      anovaLevels: isAnova ? anovaGroup.values : null,
    };
  }, [column, testType, alpha, alternative, mu0Str, correction, varianceTestType,
      group1, group2, anovaGroup, isOneSample, needsGroups, isAnova]);

  // Live re-run: silent, and only after the first deliberate run. An invalid
  // half-finished config simply produces nothing rather than an error banner.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const previousError = localError;
    const cfg = buildConfig();
    if (cfg) onLiveChange(cfg);
    else setLocalError(previousError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, testType, alpha, alternative, mu0Str, correction, varianceTestType, group1, group2, anovaGroup]);

  const doRun = () => {
    const cfg = buildConfig();
    if (cfg) onRun(cfg);
  };

  const doReset = () => {
    setColumn(state.numericCols[0] ?? '');
    setTestType(ONE_SAMPLE_T);
    setAlpha(0.05);
    setAlternative('two-sided');
    setMu0Str('');
    setCorrection(true);
    setVarianceTestType('Levene');
    setGroup1(emptyGroup('Group 1'));
    setGroup2(emptyGroup('Group 2'));
    setAnovaGroup(emptyGroup('Groups'));
    setLocalError(null);
    onReset();
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--color-text-muted)] text-sm">
        No dataset loaded. Go to the Data tab to upload a CSV.
      </div>
    );
  }

  const overlapping =
    needsGroups && group1.column && group1.column === group2.column &&
    group1.values.some((v) => group2.values.includes(v));

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-1 pb-4 custom-scrollbar">
      <SectionLabel>Test</SectionLabel>
      <SelectField label="Type of Hypothesis" value={testType} onChange={setTestType} options={TEST_TYPES} />
      <SelectField label="Variable" value={column} onChange={setColumn} options={state.numericCols} />

      <Divider />

      {isOneSample && (
        <>
          <SectionLabel>Hypothesis</SectionLabel>
          <TextInput label="Null value μ₀" value={mu0Str} onChange={setMu0Str} placeholder="e.g. 100" />
        </>
      )}

      {showAlternative && <AlternativeRadio value={alternative} onChange={setAlternative} />}

      {testType === TWO_SAMPLE_T && (
        <Toggle label="Welch correction (unequal variances)" value={correction} onChange={setCorrection} />
      )}

      {testType === EQUAL_VARIANCE && (
        <SelectField label="Variance test" value={varianceTestType} onChange={setVarianceTestType} options={['Levene', 'Bartlett']} />
      )}

      {needsGroups && (
        <>
          <SectionLabel>Groups</SectionLabel>
          <GroupBuilder label="Group 1" value={group1} onChange={setGroup1} categoricalCols={state.categoricalCols} />
          <GroupBuilder label="Group 2" value={group2} onChange={setGroup2} categoricalCols={state.categoricalCols} />
          {overlapping && (
            <p className="text-[10px] text-amber-500 mb-2">
              These groups share categories. A two-sample test assumes they are independent.
            </p>
          )}
        </>
      )}

      {isAnova && (
        <>
          <SectionLabel>Groups</SectionLabel>
          <GroupBuilder label="Factor" value={anovaGroup} onChange={setAnovaGroup} categoricalCols={state.categoricalCols} showName={false} />
        </>
      )}

      <Divider />

      <SectionLabel>Decision</SectionLabel>
      <DualInput label="Significance α" value={alpha} min={0.001} max={0.5} step={0.001} decimals={3} onChange={setAlpha} />
      <p className="text-[10px] text-[var(--color-text-muted)]">
        Drag α and watch the rejection region grow or shrink. The statistic does not move — only the boundary does.
      </p>

      {(localError || error) && <p className="text-xs text-red-400 mt-2">{localError || error}</p>}

      <div className="mt-auto pt-4 flex gap-2">
        <button
          type="button"
          onClick={doRun}
          disabled={isComputing}
          className="flex-1 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold
            hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isComputing ? 'Running...' : '▶ Run Test'}
        </button>
        <button
          type="button"
          onClick={doReset}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-md)]
            text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
