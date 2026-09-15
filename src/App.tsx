import Spreadsheet from "./components/Spreadsheet";

export default function App() {
  return (
    <div className="flex h-full flex-col bg-slate-100">
      <header className="flex flex-none items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 9h16M4 15h16M10 5v14M15 5v14" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight text-slate-800">
            Gridsheet
          </h1>
          <p className="hidden text-xs leading-tight text-slate-400 sm:block">
            A fast little spreadsheet — formulas, keyboard nav & CSV, all in your browser
          </p>
        </div>
        <a
          href="https://github.com"
          onClick={(e) => e.preventDefault()}
          className="ml-auto hidden select-none rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline"
          title="Try typing =SUM(A1:A5) or =A1*B1"
        >
          Tip: start a formula with “=”
        </a>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1400px] flex-col p-2 sm:p-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Spreadsheet />
          </div>
        </div>
      </main>
    </div>
  );
}
