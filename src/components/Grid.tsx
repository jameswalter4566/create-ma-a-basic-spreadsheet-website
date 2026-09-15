import React, { useMemo } from "react";
import { colToLabel, coordToRef, type Coord } from "../lib/cells";
import type { DisplayResult } from "../lib/engine";

export interface Selection {
  anchor: Coord;
  active: Coord;
}

export interface EditState {
  coord: Coord;
  value: string;
}

interface GridProps {
  rows: number;
  cols: number;
  getRaw: (ref: string) => string;
  getDisplay: (ref: string) => DisplayResult;
  selection: Selection;
  editing: EditState | null;
  columnWidth: number;
  onCellMouseDown: (coord: Coord, shiftKey: boolean) => void;
  onCellMouseEnter: (coord: Coord) => void;
  onCellDoubleClick: (coord: Coord) => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectColumn: (col: number, shiftKey: boolean) => void;
  onSelectRow: (row: number, shiftKey: boolean) => void;
  onSelectAll: () => void;
  editInputRef: React.RefObject<HTMLInputElement>;
}

const ROW_HEADER_W = 48;
const ROW_HEIGHT = 28;

function inRange(coord: Coord, sel: Selection): boolean {
  const r1 = Math.min(sel.anchor.row, sel.active.row);
  const r2 = Math.max(sel.anchor.row, sel.active.row);
  const c1 = Math.min(sel.anchor.col, sel.active.col);
  const c2 = Math.max(sel.anchor.col, sel.active.col);
  return coord.row >= r1 && coord.row <= r2 && coord.col >= c1 && coord.col <= c2;
}

export default function Grid({
  rows,
  cols,
  getRaw,
  getDisplay,
  selection,
  editing,
  columnWidth,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onEditChange,
  onEditKeyDown,
  onSelectColumn,
  onSelectRow,
  onSelectAll,
  editInputRef,
}: GridProps) {
  const rowIdx = useMemo(() => Array.from({ length: rows }, (_, i) => i), [rows]);
  const colIdx = useMemo(() => Array.from({ length: cols }, (_, i) => i), [cols]);

  const selMinCol = Math.min(selection.anchor.col, selection.active.col);
  const selMaxCol = Math.max(selection.anchor.col, selection.active.col);
  const selMinRow = Math.min(selection.anchor.row, selection.active.row);
  const selMaxRow = Math.max(selection.anchor.row, selection.active.row);

  return (
    <div className="thin-scroll h-full w-full overflow-auto bg-white">
      <table
        className="border-separate border-spacing-0 select-none"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: ROW_HEADER_W }} />
          {colIdx.map((c) => (
            <col key={c} style={{ width: columnWidth }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {/* Corner: select all */}
            <th
              className="sticky left-0 top-0 z-30 border-b border-r border-slate-300 bg-slate-100"
              style={{ height: ROW_HEIGHT }}
              onClick={onSelectAll}
            >
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-[2px] border-2 border-slate-400" />
              </div>
            </th>
            {colIdx.map((c) => {
              const activeCol = c >= selMinCol && c <= selMaxCol;
              return (
                <th
                  key={c}
                  onClick={(e) => onSelectColumn(c, e.shiftKey)}
                  className={
                    "sticky top-0 z-20 cursor-pointer border-b border-r border-slate-300 text-center text-xs font-semibold " +
                    (activeCol
                      ? "bg-brand-100 text-brand-800"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                  style={{ height: ROW_HEIGHT }}
                >
                  {colToLabel(c)}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rowIdx.map((r) => {
            const activeRow = r >= selMinRow && r <= selMaxRow;
            return (
              <tr key={r}>
                <th
                  onClick={(e) => onSelectRow(r, e.shiftKey)}
                  className={
                    "sticky left-0 z-10 cursor-pointer border-b border-r border-slate-300 text-center text-xs font-semibold " +
                    (activeRow
                      ? "bg-brand-100 text-brand-800"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                  style={{ height: ROW_HEIGHT }}
                >
                  {r + 1}
                </th>

                {colIdx.map((c) => {
                  const coord: Coord = { row: r, col: c };
                  const ref = coordToRef(coord);
                  const selected = inRange(coord, selection);
                  const isActive =
                    selection.active.row === r && selection.active.col === c;
                  const isEditing =
                    editing !== null &&
                    editing.coord.row === r &&
                    editing.coord.col === c;

                  const display = getDisplay(ref);

                  let cls =
                    "relative border-b border-r border-slate-200 px-1.5 text-sm leading-none ";
                  if (display.error) cls += "text-red-600 font-medium ";
                  else cls += "text-slate-800 ";
                  cls += display.numeric ? "text-right " : "text-left ";
                  if (selected && !isActive) cls += "bg-brand-50 ";
                  else cls += "bg-white ";

                  return (
                    <td
                      key={c}
                      className={cls}
                      style={{ height: ROW_HEIGHT }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        onCellMouseDown(coord, e.shiftKey);
                      }}
                      onMouseEnter={() => onCellMouseEnter(coord)}
                      onDoubleClick={() => onCellDoubleClick(coord)}
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          value={editing!.value}
                          onChange={(e) => onEditChange(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          onMouseDown={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 z-40 h-full w-full border-2 border-brand-500 bg-white px-1.5 text-left text-sm text-slate-900 outline-none"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      ) : (
                        <>
                          <span className="block truncate">{display.text}</span>
                          {isActive && (
                            <span className="pointer-events-none absolute inset-0 z-20 border-2 border-brand-500" />
                          )}
                        </>
                      )}
                      {/* keep raw title for quick inspection */}
                      {!isEditing && getRaw(ref).startsWith("=") ? (
                        <span className="sr-only">{getRaw(ref)}</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
