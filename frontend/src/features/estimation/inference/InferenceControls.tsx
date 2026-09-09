import { useState, useCallback, useEffect } from 'react';
import { useData } from '../../../context/DataContext';
import { inferenceApi, type EstimatorOptions } from '../../../api/inference';
import type { InferenceConfig } from './useInferenceTabState';

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

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-[var(--color-text-muted)]">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md px-2.5 py-1.5 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-md)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] cursor-pointer">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, hint, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; error?: boolean }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className={`text-xs ${error ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-md px-2.5 py-1.5 text-xs font-mono bg-[var(--color-bg-input)] border ${error ? 'border-red-500/50' : 'border-[var(--color-border-md)]'} text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none ${error ? 'focus:border-red-500' : 'focus:border-[var(--color-accent)]'}`} />
      {hint && <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mb-2">
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative w-8 h-4 rounded-full transition-colors ${value ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-md)]'}`}>
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-xs text-[var(--color-text)]">{label}</span>
    </label>
  )
}

function Accordion({ title, children, isOpen, onToggle }: { title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="mb-3 border border-[var(--color-border-md)] rounded-md overflow-hidden shrink-0">
      <button type="button" onClick={onToggle} className="w-full text-left px-3 py-2 text-xs font-semibold bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text)] flex justify-between items-center">
        {title} <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && <div className="p-3 bg-[var(--color-bg)] text-xs border-t border-[var(--color-border-md)]">{children}</div>}
    </div>
  )
}

export default function InferenceControls({ onRun, onReset, isComputing }: { onRun: (cfg: InferenceConfig) => void; onReset: () => void; isComputing: boolean }) {
  const { state } = useData();
  const [column, setColumn] = useState<string>(state.numericCols[0] ?? '');
  const [estimationType, setEstimationType] = useState<InferenceConfig['estimationType']>('Confidence and Prediction Intervals');
  const [alphaStr, setAlphaStr] = useState('0.05');
  
  const [estimatorOpts, setEstimatorOpts] = useState<EstimatorOptions>({ mean_estimators: ['Sample Mean'], deviation_estimators: ['Deviation (1 ddof)'] });
  
  // ponytail: mean/median estimators fixed — only Sample Mean / Sample Median have verified formulas
  const [sigmaEst, setSigmaEst] = useState('Deviation (1 ddof)');
  
  const [bootstrapMean, setBootstrapMean] = useState(false);
  const [bootstrapMedian, setBootstrapMedian] = useState(false);
  const [bootstrapDeviation, setBootstrapDeviation] = useState(false);
  const [bootstrapPi, setBootstrapPi] = useState(false);
  const [samplesStr, setSamplesStr] = useState('1000');
  
  const [crProbs, setCrProbs] = useState('0.1, 0.5, 0.75, 0.89, 0.95');
  const [crEpsMu, setCrEpsMu] = useState('0.1, 0.1');
  const [crEpsSigma, setCrEpsSigma] = useState('0.05, 0.05');
  const [addCiBox, setAddCiBox] = useState(true);
  const [muCiSource, setMuCiSource] = useState('Mean-based CI');
  
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [estimatorsOpen, setEstimatorsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasData = state.status === 'ready' && state.numericCols.length > 0;

  useEffect(() => {
    if (hasData && column && state.sessionId) {
      inferenceApi.getEstimators({ session_id: state.sessionId, column })
        .then(opts => {
          setEstimatorOpts(opts);
          if (!opts.deviation_estimators.includes(sigmaEst)) setSigmaEst(opts.deviation_estimators[0] || 'Deviation (1 ddof)');
        }).catch(() => console.error("Failed to load estimators"));
    }
  }, [hasData, column, state.sessionId]);

  const handleRun = useCallback(() => {
    setError(null);
    if (!column) { setError('Please select a numeric variable'); return; }
    const alpha = parseFloat(alphaStr);
    if (isNaN(alpha) || alpha <= 0 || alpha >= 1) { setError('Alpha must be between 0 and 1'); return; }
    
    const samples = parseInt(samplesStr, 10);
    if (isNaN(samples) || samples <= 0) { setError('Bootstrap samples must be a positive integer'); return; }
    
    onRun({
      column,
      estimationType,
      alpha,
      mean_estimator: 'Sample Mean',
      median_estimator: 'Sample Median',
      sigma_estimator: sigmaEst,
      trim_param: null,
      winsor_limits: null,
      weights_column: null,
      bootstrap_mean: bootstrapMean,
      bootstrap_median: bootstrapMedian,
      bootstrap_deviation: bootstrapDeviation,
      bootstrap_pi: bootstrapPi,
      bootstrap_samples: samples,
      probs: crProbs,
      eps_mu: crEpsMu,
      eps_sigma: crEpsSigma,
      add_ci_box: addCiBox,
      mu_ci_source: muCiSource
    });
  }, [column, estimationType, alphaStr, sigmaEst, bootstrapMean, bootstrapMedian, bootstrapDeviation, bootstrapPi, samplesStr, crProbs, crEpsMu, crEpsSigma, addCiBox, muCiSource, onRun]);

  // Initial and reactive run when column changes
  useEffect(() => {
    if (hasData && column) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, column, estimationType]);

  const doReset = () => {
    setColumn(state.numericCols[0] ?? '');
    setEstimationType('Confidence and Prediction Intervals');
    setAlphaStr('0.05');
    setSigmaEst('Deviation (1 ddof)');
    setBootstrapMean(false);
    setBootstrapMedian(false);
    setBootstrapDeviation(false);
    setBootstrapPi(false);
    setSamplesStr('1000');
    setCrProbs('0.1, 0.5, 0.75, 0.89, 0.95');
    setCrEpsMu('0.1, 0.1');
    setCrEpsSigma('0.05, 0.05');
    setAddCiBox(true);
    setMuCiSource('Mean-based CI');
    onReset();
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--color-text-muted)] text-sm">
        No dataset loaded. Go to the Data tab to upload a CSV.
      </div>
    );
  }

  const anyBootstrap = bootstrapMean || bootstrapMedian || bootstrapDeviation || bootstrapPi;
  const isRegions = estimationType === 'Confidence Regions';

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-1 pb-4 custom-scrollbar">
      <SectionLabel>Inference Settings</SectionLabel>
      <SelectField label="Variable" value={column} onChange={setColumn} options={state.numericCols} />
      
      <SelectField label="Estimation Type" value={estimationType} onChange={(v: any) => setEstimationType(v)} options={[
        'Confidence Intervals', 'Prediction Intervals', 'Confidence and Prediction Intervals', 'Confidence Regions'
      ]} />
      
      <Divider />
      
      <SectionLabel>Parameters</SectionLabel>
      <TextInput label="Significance level α" value={alphaStr} onChange={setAlphaStr} placeholder="0.05" hint="Each interval covers at 1−α individually — no multiplicity correction across rows." />

      {isRegions && (
        <Accordion title="Confidence Region Settings" isOpen={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)}>
          <TextInput label="Coverage levels" value={crProbs} onChange={setCrProbs} placeholder="0.1, 0.5, 0.75, 0.89, 0.95" />
          <TextInput label="Padding μ (left, right)" value={crEpsMu} onChange={setCrEpsMu} placeholder="0.1, 0.1" />
          <TextInput label="Padding σ (left, right)" value={crEpsSigma} onChange={setCrEpsSigma} placeholder="0.05, 0.05" />
          <Toggle label="Add CI Bounding Box" value={addCiBox} onChange={setAddCiBox} />
          {addCiBox && (
            <SelectField label="μ CI Source" value={muCiSource} onChange={setMuCiSource} options={['Mean-based CI', 'Median-based CI']} />
          )}
        </Accordion>
      )}

      <Accordion title="Estimators" isOpen={estimatorsOpen} onToggle={() => setEstimatorsOpen(!estimatorsOpen)}>
        <SelectField label="Deviation Estimator" value={sigmaEst} onChange={setSigmaEst} options={estimatorOpts.deviation_estimators} />
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Feeds every analytic interval — mean, median and deviation.
          Mean: Sample Mean · Median: Sample Median (fixed).
        </p>
      </Accordion>

      {!isRegions && (
        <Accordion title="Bootstrap Resampling" isOpen={bootstrapOpen} onToggle={() => setBootstrapOpen(!bootstrapOpen)}>
           <Toggle label="Bootstrap Mean CI" value={bootstrapMean} onChange={setBootstrapMean} />
           <Toggle label="Bootstrap Median CI" value={bootstrapMedian} onChange={setBootstrapMedian} />
           <Toggle label="Bootstrap Deviation CI" value={bootstrapDeviation} onChange={setBootstrapDeviation} />
           {estimationType.includes('Prediction') && <Toggle label="Bootstrap Prediction Intervals" value={bootstrapPi} onChange={setBootstrapPi} />}
           {anyBootstrap && <TextInput label="Bootstrap Samples" value={samplesStr} onChange={setSamplesStr} placeholder="1000" />}
        </Accordion>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      <div className="mt-auto pt-4 flex gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={isComputing}
          className="flex-1 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold
            hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isComputing ? 'Computing...' : '▶ Update'}
        </button>
        <button
          type="button"
          onClick={doReset}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-md)]
            text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
