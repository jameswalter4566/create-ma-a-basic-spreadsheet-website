import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import Grid, { type EditState, type Selection } from "./Grid";
import Toolbar from "./Toolbar";
import FormulaBar from "./FormulaBar";
import StatusBar from "./StatusBar";
import { useSpreadsheet } from "../hooks/useSpreadsheet";
import { coordToRef, sameCoord, type Coord } from "../lib/cells";
import { evaluateCell, type CellValue, type Sheet } from "../lib/engine";
import { parseCsv, toCsv } from "../lib/csv";

const COLUMN_WIDTH = 112;

type EditOrigin = "cell" | "formula";

export default function Spreadsheet() {
  const sheet = useSpreadsheet();
  const { state } = sheet;

  const [selection, setSelection] = useState<Selection>({
    anchor: { row: 0, col: 0 },
    active: { row: 0, col: 0 },
  });
  const [editing, setEditing] = useState<EditState | null>(null);
  const editOrigin = useRef<EditOrigin>("cell");

  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // ---- evaluation --------------------------------------------------------
  const engineSheet = useMemo<Sheet>(
    () => ({ get: (ref) => state.data[ref] }),
    [state.data],
  );

  const getDisplay = useMemo(() => {
    const cache = new Map<string, CellValue>();
    return (ref: string) => evaluateCell(ref, engineSheet, cache);
  }, [engineSheet]);

  const getRaw = useCallback((ref: string) => state.data[ref] ?? "", [state.data]);

  // ---- focus helpers -----------------------------------------------------
  const focusGrid = useCallback(() => {
    // Defer so it happens after any pending re-render.
    requestAnimationFrame(() => gridWrapRef.current?.focus());
  }, []);

  useEffect(() => {
    if (editing && editOrigin.current === "cell" && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    // Only refocus when the edited cell changes, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.coord.row, editing?.coord.col]);

  // End drag on any mouse release.
  useEffect(() => {
    const up = () => {
      isDragging.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // Focus the grid on mount so keyboard navigation works immediately.
  useEffect(() => {
    gridWrapRef.current?.focus();
  }, []);

  // ---- selection helpers -------------------------------------------------
  const clampRow = useCallback(
    (r: number) => Math.max(0, Math.min(state.rows - 1, r)),
    [state.rows],
  );
  const clampCol = useCallback(
    (c: number) => Math.max(0, Math.min(state.cols - 1, c)),
    [state.cols],
  );

  const selectCell = useCallback(
    (coord: Coord, extend: boolean) => {
      setSelection((prev) => ({
        anchor: extend ? prev.anchor : coord,
        active: coord,
      }));
    },
    [],
  );

  const moveActive = useCallback(
    (dr: number, dc: number, extend: boolean) => {
      setSelection((prev) => {
        const active = {
          row: clampRow(prev.active.row + dr),
          col: clampCol(prev.active.col + dc),
        };
        return { anchor: extend ? prev.anchor : active, active };
      });
    },
    [clampRow, clampCol],
  );

  // ---- editing lifecycle -------------------------------------------------
  const beginEdit = useCallback(
    (coord: Coord, value: string, origin: EditOrigin) => {
      editOrigin.current = origin;
      setEditing({ coord, value });
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditing(null);
    focusGrid();
  }, [focusGrid]);

  const commitEdit = useCallback(
    (move: { dr: number; dc: number } | null) => {
      setEditing((cur) => {
        if (cur) {
          const ref = coordToRef(cur.coord);
          sheet.setCell(ref, cur.value);
        }
        return null;
      });
      if (move) {
        moveActive(move.dr, move.dc, false);
      }
      focusGrid();
    },
    [sheet, moveActive, focusGrid],
  );

  // ---- grid mouse handlers ----------------------------------------------
  const onCellMouseDown = useCallback(
    (coord: Coord, shiftKey: boolean) => {
      if (editing) commitEdit(null);
      isDragging.current = true;
      selectCell(coord, shiftKey);
      focusGrid();
    },
    [editing, commitEdit, selectCell, focusGrid],
  );

  const onCellMouseEnter = useCallback(
    (coord: Coord) => {
      if (!isDragging.current) return;
      setSelection((prev) => ({ anchor: prev.anchor, active: coord }));
    },
    [],
  );

  const onCellDoubleClick = useCallback(
    (coord: Coord) => {
      beginEdit(coord, getRaw(coordToRef(coord)), "cell");
    },
    [beginEdit, getRaw],
  );

  // ---- header selection --------------------------------------------------
  const onSelectColumn = useCallback(
    (col: number, shiftKey: boolean) => {
      if (editing) commitEdit(null);
      setSelection((prev) => ({
        anchor: shiftKey ? { row: 0, col: prev.anchor.col } : { row: 0, col },
        active: { row: state.rows - 1, col },
      }));
      focusGrid();
    },
    [editing, commitEdit, state.rows, focusGrid],
  );

  const onSelectRow = useCallback(
    (row: number, shiftKey: boolean) => {
      if (editing) commitEdit(null);
      setSelection((prev) => ({
        anchor: shiftKey ? { row: prev.anchor.row, col: 0 } : { row, col: 0 },
        active: { row, col: state.cols - 1 },
      }));
      focusGrid();
    },
    [editing, commitEdit, state.cols, focusGrid],
  );

  const onSelectAll = useCallback(() => {
    if (editing) commitEdit(null);
    setSelection({
      anchor: { row: 0, col: 0 },
      active: { row: state.rows - 1, col: state.cols - 1 },
    });
    focusGrid();
  }, [editing, commitEdit, state.rows, state.cols, focusGrid]);

  // ---- edit input keydown ------------------------------------------------
  const onEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit({ dr: e.shiftKey ? -1 : 1, dc: 0 });
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit({ dr: 0, dc: e.shiftKey ? -1 : 1 });
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  const onEditChange = useCallback((value: string) => {
    setEditing((cur) => (cur ? { ...cur, value } : cur));
  }, []);

  // ---- clipboard ---------------------------------------------------------
  const selBounds = useMemo(() => {
    const r1 = Math.min(selection.anchor.row, selection.active.row);
    const r2 = Math.max(selection.anchor.row, selection.active.row);
    const c1 = Math.min(selection.anchor.col, selection.active.col);
    const c2 = Math.max(selection.anchor.col, selection.active.col);
    return { r1, r2, c1, c2 };
  }, [selection]);

  const buildClipboardText = useCallback(() => {
    const { r1, r2, c1, c2 } = selBounds;
    const lines: string[] = [];
    for (let r = r1; r <= r2; r++) {
      const cells: string[] = [];
      for (let c = c1; c <= c2; c++) {
        cells.push(getRaw(coordToRef({ row: r, col: c })));
      }
      lines.push(cells.join("\t"));
    }
    return lines.join("\n");
  }, [selBounds, getRaw]);

  const onCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (editing) return; // let the input handle its own copy
      e.preventDefault();
      e.clipboardData.setData("text/plain", buildClipboardText());
    },
    [editing, buildClipboardText],
  );

  const onCut = useCallback(
    (e: React.ClipboardEvent) => {
      if (editing) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", buildClipboardText());
      sheet.clearRange(
        { row: selBounds.r1, col: selBounds.c1 },
        { row: selBounds.r2, col: selBounds.c2 },
      );
    },
    [editing, buildClipboardText, sheet, selBounds],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (editing) return;
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;
      e.preventDefault();
      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const rows = normalized.split("\n");
      if (rows.length && rows[rows.length - 1] === "") rows.pop();
      const grid = rows.map((line) =>
        line.includes("\t") ? line.split("\t") : line.split(","),
      );
      const startRow = selection.active.row;
      const startCol = selection.active.col;
      const updates: Record<string, string> = {};
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const ref = coordToRef({ row: startRow + r, col: startCol + c });
          updates[ref] = grid[r][c];
        }
      }
      sheet.setCells(updates);
      if (grid.length && grid[0].length) {
        setSelection({
          anchor: { row: startRow, col: startCol },
          active: {
            row: startRow + grid.length - 1,
            col: startCol + grid[grid.length - 1].length - 1,
          },
        });
      }
    },
    [editing, selection.active, sheet],
  );

  // ---- grid keydown (navigation + shortcuts) -----------------------------
  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) return; // input handles keys while editing
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const k = e.key.toLowerCase();
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) sheet.redo();
          else sheet.undo();
          return;
        }
        if (k === "y") {
          e.preventDefault();
          sheet.redo();
          return;
        }
        if (k === "a") {
          e.preventDefault();
          onSelectAll();
          return;
        }
        // copy/cut/paste are handled by the clipboard events
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveActive(-1, 0, e.shiftKey);
          return;
        case "ArrowDown":
          e.preventDefault();
          moveActive(1, 0, e.shiftKey);
          return;
        case "ArrowLeft":
          e.preventDefault();
          moveActive(0, -1, e.shiftKey);
          return;
        case "ArrowRight":
          e.preventDefault();
          moveActive(0, 1, e.shiftKey);
          return;
        case "Tab":
          e.preventDefault();
          moveActive(0, e.shiftKey ? -1 : 1, false);
          return;
        case "Enter":
          e.preventDefault();
          beginEdit(selection.active, getRaw(coordToRef(selection.active)), "cell");
          return;
        case "F2":
          e.preventDefault();
          beginEdit(selection.active, getRaw(coordToRef(selection.active)), "cell");
          return;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          sheet.clearRange(
            { row: selBounds.r1, col: selBounds.c1 },
            { row: selBounds.r2, col: selBounds.c2 },
          );
          return;
        case "Home":
          e.preventDefault();
          setSelection(() => ({
            anchor: { row: selection.active.row, col: 0 },
            active: { row: selection.active.row, col: 0 },
          }));
          return;
        case "Escape":
          return;
        default:
          // Start editing when a printable character is typed.
          if (e.key.length === 1 && !e.altKey) {
            e.preventDefault();
            beginEdit(selection.active, e.key, "cell");
          }
      }
    },
    [
      editing,
      sheet,
      onSelectAll,
      moveActive,
      beginEdit,
      selection.active,
      getRaw,
      selBounds,
    ],
  );

  // ---- toolbar actions ---------------------------------------------------
  const activeRef = coordToRef(selection.active);

  const doExport = useCallback(() => {
    const csv = toCsv(state.rows, state.cols, (ref) => getDisplay(ref).text);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gridsheet.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.rows, state.cols, getDisplay]);

  const doImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        const grid = parseCsv(text);
        const data: Record<string, string> = {};
        let maxCols = 0;
        for (let r = 0; r < grid.length; r++) {
          maxCols = Math.max(maxCols, grid[r].length);
          for (let c = 0; c < grid[r].length; c++) {
            const value = grid[r][c];
            if (value !== "") data[coordToRef({ row: r, col: c })] = value;
          }
        }
        sheet.replaceState({
          data,
          rows: Math.max(50, grid.length + 5),
          cols: Math.max(26, maxCols + 2),
        });
        setSelection({
          anchor: { row: 0, col: 0 },
          active: { row: 0, col: 0 },
        });
      };
      reader.readAsText(file);
    },
    [sheet],
  );

  const doNew = useCallback(() => {
    if (
      Object.keys(state.data).length > 0 &&
      !window.confirm("Start a new sheet? This clears the current one.")
    ) {
      return;
    }
    sheet.resetSheet();
    setSelection({ anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } });
  }, [sheet, state.data]);

  // ---- status bar stats --------------------------------------------------
  const stats = useMemo(() => {
    const { r1, r2, c1, c2 } = selBounds;
    let count = 0;
    const nums: number[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const d = getDisplay(coordToRef({ row: r, col: c }));
        if (d.text !== "") count++;
        if (d.numeric && !d.error) {
          const n = Number(d.text);
          if (!Number.isNaN(n)) nums.push(n);
        }
      }
    }
    const hasNums = nums.length > 0;
    return {
      count,
      sum: hasNums ? nums.reduce((s, x) => s + x, 0) : null,
      average: hasNums ? nums.reduce((s, x) => s + x, 0) / nums.length : null,
      min: hasNums ? Math.min(...nums) : null,
      max: hasNums ? Math.max(...nums) : null,
    };
  }, [selBounds, getDisplay]);

  const selectionLabel = useMemo(() => {
    const { r1, r2, c1, c2 } = selBounds;
    if (r1 === r2 && c1 === c2) return coordToRef({ row: r1, col: c1 });
    const rowsN = r2 - r1 + 1;
    const colsN = c2 - c1 + 1;
    return `${coordToRef({ row: r1, col: c1 })}:${coordToRef({
      row: r2,
      col: c2,
    })} (${rowsN}×${colsN})`;
  }, [selBounds]);

  // ---- formula bar value -------------------------------------------------
  const formulaEditing =
    editing !== null && sameCoord(editing.coord, selection.active);
  const formulaValue = formulaEditing ? editing!.value : getRaw(activeRef);

  const onFormulaFocus = useCallback(() => {
    if (!formulaEditing) {
      beginEdit(selection.active, getRaw(activeRef), "formula");
    }
  }, [formulaEditing, beginEdit, selection.active, getRaw, activeRef]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        onImportClick={() => fileInputRef.current?.click()}
        onExport={doExport}
        onNew={doNew}
        onUndo={sheet.undo}
        onRedo={sheet.redo}
        canUndo={sheet.canUndo}
        canRedo={sheet.canRedo}
        onInsertRow={() => sheet.insertRow(selBounds.r1)}
        onDeleteRow={() => sheet.deleteRow(selBounds.r1)}
        onInsertCol={() => sheet.insertCol(selBounds.c1)}
        onDeleteCol={() => sheet.deleteCol(selBounds.c1)}
        onAddRows={() => sheet.addRows(10)}
        onAddCols={() => sheet.addCols(5)}
        fileInputRef={fileInputRef}
        onFileChosen={doImport}
      />

      <FormulaBar
        cellRef={activeRef}
        value={formulaValue}
        editing={formulaEditing}
        onChange={onEditChange}
        onCommit={() => commitEdit({ dr: 1, dc: 0 })}
        onCancel={cancelEdit}
        onFocus={onFormulaFocus}
      />

      <div
        ref={gridWrapRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        className="min-h-0 flex-1 outline-none"
      >
        <Grid
          rows={state.rows}
          cols={state.cols}
          getRaw={getRaw}
          getDisplay={getDisplay}
          selection={selection}
          editing={editing}
          columnWidth={COLUMN_WIDTH}
          onCellMouseDown={onCellMouseDown}
          onCellMouseEnter={onCellMouseEnter}
          onCellDoubleClick={onCellDoubleClick}
          onEditChange={onEditChange}
          onEditKeyDown={onEditKeyDown}
          onSelectColumn={onSelectColumn}
          onSelectRow={onSelectRow}
          onSelectAll={onSelectAll}
          editInputRef={editInputRef}
        />
      </div>

      <StatusBar
        selectionLabel={selectionLabel}
        count={stats.count}
        sum={stats.sum}
        average={stats.average}
        min={stats.min}
        max={stats.max}
      />
    </div>
  );
}
