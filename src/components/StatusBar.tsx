interface StatusBarProps {
  selectionLabel: string;
  count: number;
  sum: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
}

function fmt(n: number): string {
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function StatusBar({
  selectionLabel,
  count,
  sum,
  average,
  min,
  max,
}: StatusBarProps) {
  const hasNumbers = sum !== null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
      <span className="font-mono font-semibold text-slate-600">{selectionLabel}</span>
      <span>
        Count: <span className="font-semibold text-slate-700">{count}</span>
      </span>
      {hasNumbers && (
        <>
          <span>
            Sum: <span className="font-semibold text-slate-700">{fmt(sum!)}</span>
          </span>
          <span>
            Avg: <span className="font-semibold text-slate-700">{fmt(average!)}</span>
          </span>
          <span>
            Min: <span className="font-semibold text-slate-700">{fmt(min!)}</span>
          </span>
          <span>
            Max: <span className="font-semibold text-slate-700">{fmt(max!)}</span>
          </span>
        </>
      )}
      <span className="ml-auto hidden text-slate-400 sm:inline">
        Autosaves to this browser
      </span>
    </div>
  );
}
