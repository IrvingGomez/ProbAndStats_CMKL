import { useData } from '../../context/DataContext';
import type { GroupSpec } from '../../api/hypothesis';

/**
 * A group is the union of one or more selected values of one categorical column.
 * Two builders are independent, so group 1 and group 2 may name different
 * columns — that flexibility is inherited from the original Gradio app.
 */
export default function GroupBuilder({
  label,
  value,
  onChange,
  categoricalCols,
  showName = true,
}: {
  label: string;
  value: GroupSpec;
  onChange: (next: GroupSpec) => void;
  categoricalCols: string[];
  showName?: boolean;
}) {
  const { getUniqueValues } = useData();
  const levels = value.column ? getUniqueValues(value.column) : [];

  const setColumn = (column: string) => {
    // Values belong to the old column; clearing them avoids a silently empty group.
    onChange({ ...value, column, values: [] });
  };

  const toggleValue = (level: string) => {
    const selected = value.values.includes(level)
      ? value.values.filter((v) => v !== level)
      : [...value.values, level];

    // Mirrors the Gradio app: the name follows the first selection until the
    // student types their own.
    const autoNamed = !value.name || value.name === value.values[0];
    const name = autoNamed ? (selected[0] ?? '') : value.name;
    onChange({ ...value, values: selected, name });
  };

  return (
    <div className="mb-3 border border-[var(--color-border-md)] rounded-md overflow-hidden">
      <div className="bg-[var(--color-bg-input)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] border-b border-[var(--color-border-md)] flex justify-between items-center">
        <span>{label}</span>
        <span className="text-[10px] font-normal text-[var(--color-text-muted)]">
          {value.values.length} selected
        </span>
      </div>

      <div className="p-2.5">
        <div className="flex flex-col gap-1 mb-2">
          <label className="text-xs text-[var(--color-text-muted)]">Column</label>
          <select
            value={value.column}
            onChange={(e) => setColumn(e.target.value)}
            className="w-full rounded-md px-2.5 py-1.5 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-md)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
          >
            <option value="">Select a column…</option>
            {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {value.column && (
          <>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[var(--color-text-muted)]">Values</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...value, values: levels })}
                  className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, values: [] })}
                  className="text-[10px] text-[var(--color-text-muted)] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-32 overflow-y-auto custom-scrollbar rounded-md border border-[var(--color-border-md)] bg-[var(--color-bg)] p-1.5 mb-2">
              {levels.length === 0 && (
                <p className="text-[10px] text-[var(--color-text-muted)] px-1 py-0.5">No values found.</p>
              )}
              {levels.map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-[var(--color-bg-hover)]">
                  <input
                    type="checkbox"
                    checked={value.values.includes(level)}
                    onChange={() => toggleValue(level)}
                    className="accent-[var(--color-accent)] cursor-pointer"
                  />
                  <span className="text-xs text-[var(--color-text)] truncate" title={level}>{level}</span>
                </label>
              ))}
            </div>

            {showName && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-muted)]">Name</label>
                <input
                  type="text"
                  value={value.name}
                  onChange={(e) => onChange({ ...value, name: e.target.value })}
                  placeholder={label}
                  className="w-full rounded-md px-2.5 py-1.5 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-md)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
