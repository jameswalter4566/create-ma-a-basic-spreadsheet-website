import React from "react";

interface FormulaBarProps {
  cellRef: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onFocus: () => void;
}

export default function FormulaBar({
  cellRef,
  value,
  editing,
  onChange,
  onCommit,
  onCancel,
  onFocus,
}: FormulaBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-stretch border-b border-slate-200 bg-white">
      <div className="flex w-16 flex-none items-center justify-center border-r border-slate-200 font-mono text-sm font-semibold text-slate-600 sm:w-20">
        {cellRef}
      </div>
      <div className="flex flex-none items-center px-2 text-slate-400">
        <span className="font-mono text-sm italic">fx</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder="Enter a value or a formula, e.g. =SUM(A1:A10)"
        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-sm text-slate-800 outline-none placeholder:text-slate-300"
        spellCheck={false}
        autoComplete="off"
        aria-label={`Formula for cell ${cellRef}`}
        data-formula-bar={editing ? "editing" : "idle"}
      />
    </div>
  );
}
