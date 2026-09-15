// Cell address helpers: convert between column indices and A/B/.../AA labels,
// and between "A1" style references and {row, col} coordinates. All coordinates
// are 0-based internally.

export interface Coord {
  row: number;
  col: number;
}

/** 0-based column index -> spreadsheet label. 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function colToLabel(index: number): string {
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/** Spreadsheet label -> 0-based column index. "A" -> 0, "AA" -> 26. */
export function labelToCol(label: string): number {
  let n = 0;
  for (let i = 0; i < label.length; i++) {
    n = n * 26 + (label.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** {row,col} -> "A1" style reference. */
export function coordToRef(coord: Coord): string {
  return colToLabel(coord.col) + (coord.row + 1);
}

const REF_RE = /^([A-Za-z]+)(\d+)$/;

/** "A1" -> {row,col}, or null if malformed. */
export function refToCoord(ref: string): Coord | null {
  const m = REF_RE.exec(ref.trim());
  if (!m) return null;
  const col = labelToCol(m[1].toUpperCase());
  const row = parseInt(m[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function coordKey(coord: Coord): string {
  return `${coord.row}:${coord.col}`;
}
