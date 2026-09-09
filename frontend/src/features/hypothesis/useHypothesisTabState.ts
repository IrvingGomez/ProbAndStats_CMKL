import { useCallback, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  hypothesisApi,
  ONE_SAMPLE_T,
  type Alternative,
  type GroupSpec,
  type HypothesisResponse,
} from '../../api/hypothesis';

export type HypothesisConfig = {
  column: string;
  testType: string;
  alpha: number;
  alternative: Alternative;
  mu0: number | null;
  correction: boolean;
  varianceTestType: string;
  group1: GroupSpec | null;
  group2: GroupSpec | null;
  anovaColumn: string | null;
  anovaLevels: string[] | null;
};

export const DEFAULT_CONFIG: HypothesisConfig = {
  column: '',
  testType: ONE_SAMPLE_T,
  alpha: 0.05,
  alternative: 'two-sided',
  mu0: null,
  correction: true,
  varianceTestType: 'Levene',
  group1: null,
  group2: null,
  anovaColumn: null,
  anovaLevels: null,
};

// The first test is run deliberately, from the button. After that the controls
// are live: α especially is meant to be dragged, and every one of the four tests
// is analytic, so a re-run costs a few milliseconds.
const DEBOUNCE_MS = 250;

export function useHypothesisTabState() {
  const { state: dataState } = useData();
  const [result, setResult] = useState<HypothesisResponse | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Show, don't tell": the rejection region and the statistic marker are drawn
  // immediately, but the p-value, the verdict and the raw result table stay
  // hidden until the student asks — the plot should answer first. Every new
  // result hides them again.
  const [revealed, setRevealed] = useState(false);

  const hasRunRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (cfg: HypothesisConfig) => {
    if (!dataState.sessionId) {
      setError('No active session. Please upload a dataset first.');
      return;
    }

    setError(null);
    setIsComputing(true);

    try {
      const res = await hypothesisApi.runTest({
        session_id: dataState.sessionId,
        column: cfg.column,
        test_type: cfg.testType,
        alpha: cfg.alpha,
        alternative: cfg.alternative,
        mu0: cfg.mu0,
        correction: cfg.correction,
        variance_test_type: cfg.varianceTestType,
        group1: cfg.group1,
        group2: cfg.group2,
        anova_column: cfg.anovaColumn,
        anova_levels: cfg.anovaLevels,
        filters: Object.keys(dataState.filters).length > 0 ? dataState.filters : null,
      });
      setResult(res);
      setRevealed(false);
      hasRunRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
      setResult(null);
    } finally {
      setIsComputing(false);
    }
  }, [dataState.sessionId, dataState.filters]);

  const handleRun = useCallback((cfg: HypothesisConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void run(cfg);
  }, [run]);

  /** Re-run on a control change, but only once the student has run the test once. */
  const handleLiveChange = useCallback((cfg: HypothesisConfig) => {
    if (!hasRunRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void run(cfg), DEBOUNCE_MS);
  }, [run]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hasRunRef.current = false;
    setResult(null);
    setError(null);
    setRevealed(false);
  }, []);

  return {
    result,
    isComputing,
    error,
    revealed,
    onReveal: () => setRevealed(true),
    handleRun,
    handleLiveChange,
    handleReset,
    hasData: dataState.status === 'ready' && dataState.numericCols.length > 0,
    numericCols: dataState.numericCols,
    categoricalCols: dataState.categoricalCols,
    precision: dataState.displayPrecision,
    sessionId: dataState.sessionId,
  };
}
