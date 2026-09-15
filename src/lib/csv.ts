// Minimal, robust CSV parsing and serialization (RFC-4180-ish).

import { colToLabel } from "./cells";

/** Parse CSV text into a 2D array of strings. Handles quotes and embedded commas/newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      pushField();
      i++;
    } else if (c === "\r") {
      // handle CRLF and lone CR
      pushRow();
      if (text[i + 1] === "\n") i += 2;
      else i++;
    } else if (c === "\n") {
      pushRow();
      i++;
    } else {
      field += c;
      i++;
    }
  }

  // flush trailing field/row unless the input ended exactly on a newline
  if (field !== "" || row.length > 0) {
    pushRow();
  }

  return rows;
}

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Serialize the sheet to CSV. `getRaw` returns the raw content for a given
 * reference; we export the *displayed* value via `getDisplay` when provided so
 * formulas export as their computed result (like most spreadsheet apps).
 */
export function toCsv(
  rows: number,
  cols: number,
  getCell: (ref: string) => string,
): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      const ref = colToLabel(c) + (r + 1);
      cells.push(escapeField(getCell(ref)));
    }
    // Trim trailing empty cells to keep files tidy.
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    lines.push(cells.join(","));
  }
  // Trim trailing empty rows.
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
