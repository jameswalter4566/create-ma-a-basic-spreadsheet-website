# Gridsheet

A fast, minimal spreadsheet that runs entirely in your browser. Built with
Vite + React + TypeScript + Tailwind CSS. No account, no server — your work
autosaves to your browser.

## Features

- **Grid of editable cells** with A/B/C… column headers and numbered rows.
- **Formulas** — start a cell with `=`. Supports:
  - Arithmetic `+ - * / ^`, parentheses, unary minus, and `%`.
  - Cell references (`A1`) and ranges (`A1:B10`).
  - Comparisons (`= <> < > <= >=`) and string concat (`&`).
  - Functions: `SUM, AVERAGE/AVG, MIN, MAX, COUNT, COUNTA, PRODUCT, ABS,
    ROUND, FLOOR, CEILING, INT, MOD, POWER, SQRT, PI, IF, AND, OR, NOT,
    CONCAT/CONCATENATE, LEN, LOWER, UPPER, TRIM`.
  - Circular-reference and error detection (`#DIV/0!`, `#NAME?`, `#CIRC!`, …).
- **Keyboard-first navigation** — arrows to move, Enter/F2 to edit, Tab to move
  right, type to overwrite, Delete to clear, Shift+arrows to extend a selection.
- **Range selection** with click-drag or Shift-click, plus a live status bar
  showing Count / Sum / Average / Min / Max.
- **Copy / cut / paste** (including to and from other spreadsheets and Excel via
  TSV/CSV on the clipboard).
- **Insert / delete rows & columns**, and append more rows/columns as you grow.
- **CSV import & export**.
- **Undo / redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Y or Shift+Ctrl/Cmd+Z).
- **Autosave** to `localStorage`.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Move selection | Arrow keys |
| Extend selection | Shift + Arrow keys |
| Edit active cell | Enter or F2, or just start typing |
| Commit + move down / up | Enter / Shift+Enter |
| Commit + move right / left | Tab / Shift+Tab |
| Cancel edit | Esc |
| Clear cells | Delete / Backspace |
| Copy / Cut / Paste | Ctrl/Cmd + C / X / V |
| Undo / Redo | Ctrl/Cmd + Z / Y |
| Select all | Ctrl/Cmd + A |

## Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build (dist/)
npm run preview    # preview the production build
```

### Single-file preview

`npm run build:preview` produces a completely self-contained
`dist-singlefile/index.html` with all JS/CSS inlined — open it directly in a
browser with no server.

## Project structure

```
src/
  lib/
    cells.ts      # A1 <-> {row,col} address helpers
    engine.ts     # formula tokenizer, parser & evaluator
    csv.ts        # CSV parse / serialize
  hooks/
    useSpreadsheet.ts   # sheet state, history (undo/redo), persistence
  components/
    Spreadsheet.tsx     # orchestrates selection, editing, clipboard, shortcuts
    Grid.tsx            # the cell grid
    Toolbar.tsx         # actions (new/import/export/undo/insert/delete…)
    FormulaBar.tsx      # active-cell reference + formula input
    StatusBar.tsx       # selection stats
  App.tsx
  main.tsx
```
