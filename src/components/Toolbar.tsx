import React from "react";

interface ToolbarProps {
  onImportClick: () => void;
  onExport: () => void;
  onNew: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onInsertRow: () => void;
  onDeleteRow: () => void;
  onInsertCol: () => void;
  onDeleteCol: () => void;
  onAddRows: () => void;
  onAddCols: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChosen: (file: File) => void;
}

function Btn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px flex-none bg-slate-200" />;
}

export default function Toolbar(props: ToolbarProps) {
  const {
    onImportClick,
    onExport,
    onNew,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onInsertRow,
    onDeleteRow,
    onInsertCol,
    onDeleteCol,
    onAddRows,
    onAddCols,
    fileInputRef,
    onFileChosen,
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white px-2 py-1.5">
      <Btn onClick={onNew} title="Start a new, empty sheet">
        <IconFile />
        <span className="hidden sm:inline">New</span>
      </Btn>
      <Btn onClick={onImportClick} title="Import a CSV file">
        <IconUpload />
        <span className="hidden sm:inline">Import</span>
      </Btn>
      <Btn onClick={onExport} title="Export as CSV">
        <IconDownload />
        <span className="hidden sm:inline">Export</span>
      </Btn>

      <Divider />

      <Btn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <IconUndo />
      </Btn>
      <Btn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <IconRedo />
      </Btn>

      <Divider />

      <Btn onClick={onInsertRow} title="Insert a row above the selection">
        <IconRowInsert />
        <span className="hidden md:inline">Row</span>
      </Btn>
      <Btn onClick={onDeleteRow} title="Delete the selected row">
        <IconRowDelete />
        <span className="hidden md:inline">Row</span>
      </Btn>
      <Btn onClick={onInsertCol} title="Insert a column left of the selection">
        <IconColInsert />
        <span className="hidden md:inline">Col</span>
      </Btn>
      <Btn onClick={onDeleteCol} title="Delete the selected column">
        <IconColDelete />
        <span className="hidden md:inline">Col</span>
      </Btn>

      <Divider />

      <Btn onClick={onAddRows} title="Append 10 more rows">
        <IconPlus />
        <span className="hidden md:inline">10 rows</span>
      </Btn>
      <Btn onClick={onAddCols} title="Append 5 more columns">
        <IconPlus />
        <span className="hidden md:inline">5 cols</span>
      </Btn>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileChosen(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* --- tiny inline icons (no external deps) --- */
const iconCls = "h-4 w-4";

function IconFile() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function IconUndo() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
    </svg>
  );
}
function IconRedo() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h4" />
    </svg>
  );
}
function IconRowInsert() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="12" width="18" height="8" rx="1" />
      <path d="M12 4v6M9 7h6" />
    </svg>
  );
}
function IconRowDelete() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="12" width="18" height="8" rx="1" />
      <path d="M9 7h6" />
    </svg>
  );
}
function IconColInsert() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="12" y="3" width="8" height="18" rx="1" />
      <path d="M4 12h6M7 9v6" />
    </svg>
  );
}
function IconColDelete() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="12" y="3" width="8" height="18" rx="1" />
      <path d="M7 9v6" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
