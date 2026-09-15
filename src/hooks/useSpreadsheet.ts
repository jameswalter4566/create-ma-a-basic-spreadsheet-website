import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coordToRef, labelToCol, type Coord } from "../lib/cells";

export interface SheetState {
  data: Record<string, string>;
  rows: number;
  cols: number;
}

const STORAGE_KEY = "gridsheet:v1";
const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;
const MAX_HISTORY = 100;

function makeEmptyState(): SheetState {
  return { data: {}, rows: DEFAULT_ROWS, cols: DEFAULT_COLS };
}

function loadState(): SheetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<SheetState>;
    if (!parsed || typeof parsed !== "object") return seedState();
    return {
      data: parsed.data ?? {},
      rows: Math.max(1, parsed.rows ?? DEFAULT_ROWS),
      cols: Math.max(1, parsed.cols ?? DEFAULT_COLS),
    };
  } catch {
    return seedState();
  }
}

// A friendly starter sheet so the app never looks empty on first run.
function seedState(): SheetState {
  const data: Record<string, string> = {
    A1: "Item",
    B1: "Qty",
    C1: "Price",
    D1: "Total",
    A2: "Coffee beans",
    B2: "3",
    C2: "12.5",
    D2: "=B2*C2",
    A3: "Oat milk",
    B3: "5",
    C3: "4.2",
    D3: "=B3*C3",
    A4: "Filters",
    B4: "2",
    C4: "6",
    D4: "=B4*C4",
    A6: "Subtotal",
    D6: "=SUM(D2:D4)",
    A7: "Tax (8%)",
    D7: "=D6*0.08",
    A8: "Grand total",
    D8: "=D6+D7",
  };
  return { data, rows: DEFAULT_ROWS, cols: DEFAULT_COLS };
}

export interface UseSpreadsheet {
  state: SheetState;
  get: (ref: string) => string;
  setCell: (ref: string, value: string) => void;
  setCells: (updates: Record<string, string>) => void;
  clearRange: (from: Coord, to: Coord) => void;
  addRows: (count: number) => void;
  addCols: (count: number) => void;
  insertRow: (at: number) => void;
  insertCol: (at: number) => void;
  deleteRow: (at: number) => void;
  deleteCol: (at: number) => void;
  resetSheet: () => void;
  replaceState: (next: SheetState) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useSpreadsheet(): UseSpreadsheet {
  const [state, setState] = useState<SheetState>(() => loadState());
  const past = useRef<SheetState[]>([]);
  const future = useRef<SheetState[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  // Persist (debounced via microtask-ish effect on each change).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage may be unavailable (private mode / quota) — ignore.
    }
  }, [state]);

  const commit = useCallback((updater: (prev: SheetState) => SheetState) => {
    setState((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      past.current.push(prev);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const get = useCallback((ref: string) => state.data[ref] ?? "", [state.data]);

  const setCell = useCallback(
    (ref: string, value: string) => {
      commit((prev) => {
        const cur = prev.data[ref] ?? "";
        if (cur === value) return prev;
        const data = { ...prev.data };
        if (value === "") delete data[ref];
        else data[ref] = value;
        return { ...prev, data };
      });
    },
    [commit],
  );

  const setCells = useCallback(
    (updates: Record<string, string>) => {
      commit((prev) => {
        const data = { ...prev.data };
        let rows = prev.rows;
        let cols = prev.cols;
        for (const [ref, value] of Object.entries(updates)) {
          if (value === "") delete data[ref];
          else data[ref] = value;
          // grow the sheet to fit pasted/imported content
          const m = /^([A-Z]+)(\d+)$/.exec(ref);
          if (m) {
            const r = parseInt(m[2], 10);
            if (r > rows) rows = r;
            const c = labelToCol(m[1]) + 1;
            if (c > cols) cols = c;
          }
        }
        return { ...prev, data, rows, cols };
      });
    },
    [commit],
  );

  const clearRange = useCallback(
    (from: Coord, to: Coord) => {
      commit((prev) => {
        const r1 = Math.min(from.row, to.row);
        const r2 = Math.max(from.row, to.row);
        const c1 = Math.min(from.col, to.col);
        const c2 = Math.max(from.col, to.col);
        const data = { ...prev.data };
        let changed = false;
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const ref = coordToRef({ row: r, col: c });
            if (ref in data) {
              delete data[ref];
              changed = true;
            }
          }
        }
        return changed ? { ...prev, data } : prev;
      });
    },
    [commit],
  );

  const addRows = useCallback(
    (count: number) => commit((prev) => ({ ...prev, rows: prev.rows + count })),
    [commit],
  );
  const addCols = useCallback(
    (count: number) => commit((prev) => ({ ...prev, cols: prev.cols + count })),
    [commit],
  );

  // Structural edits shift existing cell contents. We rebuild the data map.
  const remap = useCallback(
    (
      prev: SheetState,
      mapCoord: (c: Coord) => Coord | null,
      rows: number,
      cols: number,
    ): SheetState => {
      const data: Record<string, string> = {};
      for (const [ref, value] of Object.entries(prev.data)) {
        const m = /^([A-Z]+)(\d+)$/.exec(ref);
        if (!m) continue;
        const coord: Coord = {
          col: labelToCol(m[1]),
          row: parseInt(m[2], 10) - 1,
        };
        const mapped = mapCoord(coord);
        if (mapped) data[coordToRef(mapped)] = value;
      }
      return { data, rows, cols };
    },
    [],
  );

  const insertRow = useCallback(
    (at: number) => {
      commit((prev) =>
        remap(
          prev,
          (c) => ({ ...c, row: c.row >= at ? c.row + 1 : c.row }),
          prev.rows + 1,
          prev.cols,
        ),
      );
    },
    [commit, remap],
  );

  const insertCol = useCallback(
    (at: number) => {
      commit((prev) =>
        remap(
          prev,
          (c) => ({ ...c, col: c.col >= at ? c.col + 1 : c.col }),
          prev.rows,
          prev.cols + 1,
        ),
      );
    },
    [commit, remap],
  );

  const deleteRow = useCallback(
    (at: number) => {
      commit((prev) => {
        if (prev.rows <= 1) return prev;
        return remap(
          prev,
          (c) => (c.row === at ? null : { ...c, row: c.row > at ? c.row - 1 : c.row }),
          prev.rows - 1,
          prev.cols,
        );
      });
    },
    [commit, remap],
  );

  const deleteCol = useCallback(
    (at: number) => {
      commit((prev) => {
        if (prev.cols <= 1) return prev;
        return remap(
          prev,
          (c) => (c.col === at ? null : { ...c, col: c.col > at ? c.col - 1 : c.col }),
          prev.rows,
          prev.cols - 1,
        );
      });
    },
    [commit, remap],
  );

  const resetSheet = useCallback(() => {
    commit(() => makeEmptyState());
  }, [commit]);

  const replaceState = useCallback(
    (next: SheetState) => {
      commit(() => next);
    },
    [commit],
  );

  const undo = useCallback(() => {
    setState((prev) => {
      const previous = past.current.pop();
      if (!previous) return prev;
      future.current.push(prev);
      return previous;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const nxt = future.current.pop();
      if (!nxt) return prev;
      past.current.push(prev);
      return nxt;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  // historyTick keeps canUndo/canRedo fresh across renders.
  void historyTick;

  return useMemo(
    () => ({
      state,
      get,
      setCell,
      setCells,
      clearRange,
      addRows,
      addCols,
      insertRow,
      insertCol,
      deleteRow,
      deleteCol,
      resetSheet,
      replaceState,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      state,
      get,
      setCell,
      setCells,
      clearRange,
      addRows,
      addCols,
      insertRow,
      insertCol,
      deleteRow,
      deleteCol,
      resetSheet,
      replaceState,
      undo,
      redo,
      canUndo,
      canRedo,
    ],
  );
}
