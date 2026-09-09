import { useMemo } from 'react';
import type { IntervalsResponse, ConfidenceRegionsResponse } from '../../../api/inference';

interface InferenceNotebookProps {
  ciResult: IntervalsResponse | null;
  piResult: IntervalsResponse | null;
  regionResult: ConfidenceRegionsResponse | null;
  precision: number;
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 pb-1 border-b border-[var(--color-border-md)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function parseTable(result: IntervalsResponse | null): any[] {
  if (!result || !result.table) return [];
  try {
    return JSON.parse(result.table);
  } catch (e) {
    return [];
  }
}

function ResultTable({ title, components, precision }: { title: string, components: any[], precision: number }) {
  if (!components || components.length === 0) return null;
  return (
    <div className="mb-4 bg-[var(--color-bg)] rounded-md border border-[var(--color-border-md)] overflow-hidden">
      <div className="bg-[var(--color-bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] border-b border-[var(--color-border-md)]">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[var(--color-text)] whitespace-nowrap">
          <thead className="bg-[#fcfcfc] dark:bg-[var(--color-bg-input)]">
            <tr>
              <th className="px-3 py-2 font-medium text-[var(--color-text-muted)]">Statistic</th>
              <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">Lower Bound</th>
              <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">Upper Bound</th>
              <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-center">Method</th>
              <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-center">Interval Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-md)]">
            {components.map((c, i) => (
              <tr key={i} className="hover:bg-[var(--color-bg-hover)]">
                <td className="px-3 py-2 truncate max-w-[150px]" title={c.Statistic}>
                  <span className="bg-[var(--color-bg-input)] px-1.5 py-0.5 rounded border border-[var(--color-border-md)]">
                    {c.Statistic}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-right text-emerald-600 dark:text-emerald-400">{c['Lower'] !== null && c['Lower'] !== undefined ? Number(c['Lower']).toFixed(precision) : '-'}</td>
                <td className="px-3 py-2 font-mono text-right text-emerald-600 dark:text-emerald-400">{c['Upper'] !== null && c['Upper'] !== undefined ? Number(c['Upper']).toFixed(precision) : '-'}</td>
                <td className="px-3 py-2 text-center text-[var(--color-text-muted)]">{c['Method'] ?? '-'}</td>
                <td className="px-3 py-2 text-center text-[var(--color-text-muted)]">{c['Interval Type']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RegionSummary({ regionResult, precision }: { regionResult: ConfidenceRegionsResponse, precision: number }) {
  if (!regionResult) return null;
  return (
    <div className="bg-[var(--color-bg-input)] rounded-lg p-4 border border-[var(--color-border-md)] text-sm">
       <p className="font-semibold mb-2">Confidence Regions Computed</p>
       <ul className="list-disc pl-5 space-y-1 text-[var(--color-text-muted)]">
         <li><strong>Type:</strong> Joint relative likelihood over (μ, σ), χ² calibrated (2 df)</li>
         <li><strong>Resolution:</strong> {regionResult.z_matrix.length}x{regionResult.z_matrix[0]?.length || 0} grid</li>
         <li><strong>Coverage levels:</strong> {[...(regionResult.probs ?? [])].sort((a, b) => a - b).join(', ')}</li>
         <li><strong>Maximum Likelihood Estimates:</strong>
            <div className="font-mono mt-1 text-[var(--color-text)]">
              μ = {regionResult.mu_hat.toFixed(precision)}, σ = {regionResult.sigma_hat.toFixed(precision)}
            </div>
         </li>
       </ul>
       <p className="mt-3 text-xs italic">See the Observation panel for the contour plot. The dashed box is the pair of marginal CIs, not the joint region.</p>
    </div>
  );
}

export default function InferenceNotebook({ ciResult, piResult, regionResult, precision }: InferenceNotebookProps) {
  const hasData = !!(ciResult || piResult || regionResult);

  const ciComponents = useMemo(() => parseTable(ciResult), [ciResult]);
  const piComponents = useMemo(() => parseTable(piResult), [piResult]);

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar">
      <h2 className="text-lg font-bold mb-1 text-[var(--color-text)]">Statistical Inference</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-6 pb-4 border-b border-[var(--color-border-md)]">
        Detailed interval and region estimations
      </p>

      {!hasData && (
        <div className="text-center py-10 text-[var(--color-text-muted)] text-sm italic">
          No results to display. Adjust settings and click Update.
        </div>
      )}

      {regionResult && (
         <Section title="Confidence Regions">
            <RegionSummary regionResult={regionResult} precision={precision} />
         </Section>
      )}

      {ciResult && (
        <Section title="Confidence Intervals">
           <ResultTable title="Mean Estimation" components={ciComponents.filter(c => String(c.Statistic).toLowerCase().includes('mean'))} precision={precision} />
           <ResultTable title="Median Estimation" components={ciComponents.filter(c => String(c.Statistic).toLowerCase().includes('median'))} precision={precision} />
           <ResultTable title="Deviation Estimation" components={ciComponents.filter(c => String(c.Statistic).toLowerCase().includes('deviation') || String(c.Statistic).toLowerCase().includes('sigma'))} precision={precision} />
        </Section>
      )}

      {piResult && (
        <Section title="Prediction Intervals">
           <ResultTable title="Predictions" components={piComponents} precision={precision} />
        </Section>
      )}
    </div>
  );
}
