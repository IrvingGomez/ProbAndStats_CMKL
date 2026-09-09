import { useMemo } from 'react';
import type { HypothesisResponse } from '../../api/hypothesis';

interface HypothesisNotebookProps {
  result: HypothesisResponse | null;
  precision: number;
  revealed: boolean;
  onReveal: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 pb-1 border-b border-[var(--color-border-md)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function parseTable(result: HypothesisResponse | null): any[] {
  if (!result || !result.table) return [];
  try {
    return JSON.parse(result.table);
  } catch (e) {
    return [];
  }
}

/**
 * The result table is not all numeric: pingouin returns `CI95` as an array and
 * `BF10` as a string, and the ANOVA "Within" row is all nulls. A blanket
 * numeric format would print NaN across three columns.
 */
function formatCell(value: any, precision: number): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(precision);
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return String(value);
}

function RawTable({ rows, precision }: { rows: any[]; precision: number }) {
  if (rows.length === 0) return null;
  const headers = Object.keys(rows[0]);

  return (
    <div className="mb-4 bg-[var(--color-bg)] rounded-md border border-[var(--color-border-md)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[var(--color-text)] whitespace-nowrap">
          <thead className="bg-[#fcfcfc] dark:bg-[var(--color-bg-input)]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-md)]">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-[var(--color-bg-hover)]">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 font-mono text-right">{formatCell(row[h], precision)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HypothesisNotebook({ result, precision, revealed, onReveal }: HypothesisNotebookProps) {
  const rows = useMemo(() => parseTable(result), [result]);

  if (!result) {
    return (
      <div className="p-4 text-xs text-[var(--color-text-muted)]">
        Choose a test and press Run Test. The rejection region appears first; the numbers come after.
      </div>
    );
  }

  const region = result.rejection_region;
  const dofLabel = region.dof.map((d) => (Number.isInteger(d) ? d : d.toFixed(4))).join(', ');
  const crit = region.critical_values.map((c) => c.toFixed(4));
  const critLabel = region.tail === 'two-sided' ? `±${Math.abs(region.critical_values[1]).toFixed(4)}` : crit.join(', ');

  return (
    <div className="p-4 overflow-y-auto h-full custom-scrollbar">
      <Section title="Hypotheses">
        <div className="font-mono text-xs space-y-1 text-[var(--color-text)]">
          <p><span className="text-[var(--color-text-muted)]">H₀:</span> {result.h0}</p>
          <p><span className="text-[var(--color-text-muted)]">H₁:</span> {result.h1}</p>
        </div>
      </Section>

      <Section title="Decision">
        {revealed ? (
          <div
            className={`rounded-md px-3 py-2 mb-3 text-sm font-bold border ${
              result.reject
                ? 'bg-red-500/10 border-red-500/40 text-red-500'
                : 'bg-[var(--color-bg-input)] border-[var(--color-border-md)] text-[var(--color-text)]'
            }`}
          >
            {result.verdict}
          </div>
        ) : (
          <button
            type="button"
            onClick={onReveal}
            className="w-full rounded-md px-3 py-2 mb-3 text-xs font-semibold border border-dashed
              border-[var(--color-border-md)] text-[var(--color-text-muted)]
              hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
          >
            Read the plot first — click to reveal the p-value and verdict
          </button>
        )}

        <div className="text-xs font-mono space-y-1 text-[var(--color-text)]">
          <p><span className="text-[var(--color-text-muted)]">statistic </span>{result.statistic.toFixed(4)}</p>
          <p><span className="text-[var(--color-text-muted)]">df </span>{dofLabel}</p>
          <p><span className="text-[var(--color-text-muted)]">critical </span>{critLabel}</p>
          <p><span className="text-[var(--color-text-muted)]">α </span>{result.alpha}</p>
          <p>
            <span className="text-[var(--color-text-muted)]">p </span>
            {revealed
              ? result.p_value.toExponential(4)
              : <span className="tracking-widest text-[var(--color-text-muted)]">●●●●</span>}
          </p>
        </div>
      </Section>

      {result.group_summary && result.group_summary.length > 0 && (
        <Section title="Groups">
          <div className="bg-[var(--color-bg)] rounded-md border border-[var(--color-border-md)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--color-text)] whitespace-nowrap">
                <thead className="bg-[#fcfcfc] dark:bg-[var(--color-bg-input)]">
                  <tr>
                    <th className="px-3 py-2 font-medium text-[var(--color-text-muted)]">Group</th>
                    <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">n</th>
                    <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">mean</th>
                    <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">sd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-md)]">
                  {result.group_summary.map((g) => (
                    <tr key={g.name} className="hover:bg-[var(--color-bg-hover)]">
                      <td className="px-3 py-2 truncate max-w-[120px]" title={g.name}>{g.name}</td>
                      <td className="px-3 py-2 font-mono text-right">{g.n}</td>
                      <td className="px-3 py-2 font-mono text-right">{g.mean.toFixed(precision)}</td>
                      <td className="px-3 py-2 font-mono text-right">{g.sd.toFixed(precision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {result.warnings.length > 0 && (
        <Section title="Warnings">
          <ul className="text-xs text-amber-500 space-y-1 list-disc list-inside">
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Section>
      )}

      {/* The raw table carries the p-value too, so it stays behind the same gate. */}
      {revealed && (
        <Section title={`${result.test_type} — full output`}>
          <RawTable rows={rows} precision={precision} />
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Straight from the statistics library, unrounded. The CI column is always 95%,
            regardless of the α you chose above.
          </p>
        </Section>
      )}

      <Section title="Lab notebook">
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Drag α to 0.01, then to 0.10. The statistic never moves — only the boundary does.
          At which α does your verdict flip, and what did you trade away to get there?
        </p>
      </Section>
    </div>
  );
}
