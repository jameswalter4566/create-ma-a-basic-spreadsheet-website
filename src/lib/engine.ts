// A small but capable spreadsheet formula engine.
//
// Supports:
//   - Numbers, strings ("..."), booleans (TRUE/FALSE)
//   - Arithmetic:  + - * / ^  and unary minus, percentages (50%)
//   - Comparisons: = <> < > <= >=
//   - String concat with &
//   - Cell references (A1) and ranges (A1:B3)
//   - Functions: SUM, AVERAGE, AVG, MIN, MAX, COUNT, COUNTA, PRODUCT,
//     ABS, ROUND, FLOOR, CEILING, SQRT, POWER, MOD, INT,
//     IF, AND, OR, NOT, CONCAT/CONCATENATE, LEN, LOWER, UPPER, TRIM, PI
//
// Formulas are the raw cell string when it starts with "=". Evaluation is lazy
// and memoized, with circular-reference detection.

import { colToLabel, refToCoord } from "./cells";

export type CellValue = number | string | boolean;

export class FormulaError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

// A resolved value can also be a 2D range (array of arrays) used by functions.
type EvalValue = CellValue | RangeValue;
interface RangeValue {
  __range: true;
  values: CellValue[][];
}

function isRange(v: EvalValue): v is RangeValue {
  return typeof v === "object" && v !== null && (v as RangeValue).__range === true;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType =
  | "number"
  | "string"
  | "ident"
  | "ref"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "colon"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isAlpha = (c: string) =>
    (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  const isAlphaNum = (c: string) => isAlpha(c) || isDigit(c);

  while (i < n) {
    const c = input[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // String literal
    if (c === '"') {
      i++;
      let str = "";
      while (i < n && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < n) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i >= n) throw new FormulaError("#ERROR!", "Unterminated string");
      i++; // closing quote
      tokens.push({ type: "string", value: str });
      continue;
    }

    // Number
    if (isDigit(c) || (c === "." && isDigit(input[i + 1] ?? ""))) {
      let num = "";
      while (i < n && (isDigit(input[i]) || input[i] === ".")) {
        num += input[i];
        i++;
      }
      // scientific notation
      if (input[i] === "e" || input[i] === "E") {
        num += input[i];
        i++;
        if (input[i] === "+" || input[i] === "-") {
          num += input[i];
          i++;
        }
        while (i < n && isDigit(input[i])) {
          num += input[i];
          i++;
        }
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    // Identifier, cell reference, or boolean keyword
    if (isAlpha(c)) {
      let word = "";
      while (i < n && isAlphaNum(input[i])) {
        word += input[i];
        i++;
      }
      // A cell reference looks like letters followed by digits (A1, AB12).
      if (/^[A-Za-z]+\d+$/.test(word)) {
        tokens.push({ type: "ref", value: word.toUpperCase() });
      } else {
        tokens.push({ type: "ident", value: word });
      }
      continue;
    }

    // Multi-char operators
    const two = input.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }

    switch (c) {
      case "+":
      case "-":
      case "*":
      case "/":
      case "^":
      case "&":
      case "=":
      case "<":
      case ">":
      case "%":
        tokens.push({ type: "op", value: c });
        i++;
        continue;
      case "(":
        tokens.push({ type: "lparen", value: c });
        i++;
        continue;
      case ")":
        tokens.push({ type: "rparen", value: c });
        i++;
        continue;
      case ",":
        tokens.push({ type: "comma", value: c });
        i++;
        continue;
      case ":":
        tokens.push({ type: "colon", value: c });
        i++;
        continue;
      default:
        throw new FormulaError("#ERROR!", `Unexpected character '${c}'`);
    }
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser -> AST
// ---------------------------------------------------------------------------

type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "ref"; ref: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "unary"; op: string; operand: Node }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new FormulaError("#ERROR!", `Expected ${type} but got '${t.value}'`);
    }
    return this.next();
  }

  parse(): Node {
    const node = this.parseComparison();
    if (this.peek().type !== "eof") {
      throw new FormulaError("#ERROR!", `Unexpected '${this.peek().value}'`);
    }
    return node;
  }

  private parseComparison(): Node {
    let left = this.parseConcat();
    while (
      this.peek().type === "op" &&
      ["=", "<>", "<", ">", "<=", ">="].includes(this.peek().value)
    ) {
      const op = this.next().value;
      const right = this.parseConcat();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseConcat(): Node {
    let left = this.parseAdditive();
    while (this.peek().type === "op" && this.peek().value === "&") {
      this.next();
      const right = this.parseAdditive();
      left = { kind: "binary", op: "&", left, right };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    while (
      this.peek().type === "op" &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    while (
      this.peek().type === "op" &&
      (this.peek().value === "*" || this.peek().value === "/")
    ) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Node {
    if (
      this.peek().type === "op" &&
      (this.peek().value === "-" || this.peek().value === "+")
    ) {
      const op = this.next().value;
      const operand = this.parseUnary();
      return { kind: "unary", op, operand };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePostfix();
    if (this.peek().type === "op" && this.peek().value === "^") {
      this.next();
      const exp = this.parseUnary(); // right-associative
      return { kind: "binary", op: "^", left: base, right: exp };
    }
    return base;
  }

  // handles trailing '%' percentage operator
  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (this.peek().type === "op" && this.peek().value === "%") {
      this.next();
      node = { kind: "unary", op: "%", operand: node };
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.peek();

    if (t.type === "number") {
      this.next();
      return { kind: "num", value: parseFloat(t.value) };
    }

    if (t.type === "string") {
      this.next();
      return { kind: "str", value: t.value };
    }

    if (t.type === "ref") {
      this.next();
      // range?
      if (this.peek().type === "colon") {
        this.next();
        const to = this.expect("ref");
        return { kind: "range", from: t.value, to: to.value };
      }
      return { kind: "ref", ref: t.value };
    }

    if (t.type === "ident") {
      const name = t.value.toUpperCase();
      this.next();
      if (this.peek().type === "lparen") {
        this.next();
        const args: Node[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseComparison());
          while (this.peek().type === "comma") {
            this.next();
            args.push(this.parseComparison());
          }
        }
        this.expect("rparen");
        return { kind: "call", name, args };
      }
      // bare identifier: TRUE/FALSE booleans, PI constant, else a name error
      if (name === "TRUE") return { kind: "bool", value: true };
      if (name === "FALSE") return { kind: "bool", value: false };
      if (name === "PI") return { kind: "call", name: "PI", args: [] };
      throw new FormulaError("#NAME?", `Unknown name '${t.value}'`);
    }

    if (t.type === "lparen") {
      this.next();
      const inner = this.parseComparison();
      this.expect("rparen");
      return inner;
    }

    throw new FormulaError("#ERROR!", `Unexpected '${t.value}'`);
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface Sheet {
  /** Raw contents keyed by "A1"-style reference. */
  get(ref: string): string | undefined;
}

function toNumber(v: EvalValue): number {
  if (isRange(v)) throw new FormulaError("#VALUE!", "Expected a single value");
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = v.trim();
  if (s === "") return 0;
  const n = Number(s);
  if (Number.isNaN(n)) throw new FormulaError("#VALUE!", `'${v}' is not a number`);
  return n;
}

function toStr(v: EvalValue): string {
  if (isRange(v)) throw new FormulaError("#VALUE!", "Expected a single value");
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return formatNumber(v);
  return v;
}

function toBool(v: EvalValue): boolean {
  if (isRange(v)) throw new FormulaError("#VALUE!", "Expected a single value");
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = v.trim().toUpperCase();
  if (s === "TRUE") return true;
  if (s === "FALSE" || s === "") return false;
  return true;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "Infinity" : "-Infinity";
  // Trim floating point noise while keeping reasonable precision.
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

// Flatten evaluated args into a numeric list, ignoring blank/non-numeric text
// (matching typical SUM/AVERAGE behavior).
function collectNumbers(values: EvalValue[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (isRange(v)) {
      for (const row of v.values) {
        for (const cell of row) {
          if (cell === "" || cell === null || cell === undefined) continue;
          if (typeof cell === "number") out.push(cell);
          else if (typeof cell === "boolean") out.push(cell ? 1 : 0);
          else {
            const num = Number(String(cell).trim());
            if (!Number.isNaN(num) && String(cell).trim() !== "") out.push(num);
          }
        }
      }
    } else {
      out.push(toNumber(v));
    }
  }
  return out;
}

function countValues(values: EvalValue[], nonBlank: boolean): number {
  let count = 0;
  for (const v of values) {
    if (isRange(v)) {
      for (const row of v.values) {
        for (const cell of row) {
          if (nonBlank) {
            if (cell !== "" && cell !== null && cell !== undefined) count++;
          } else {
            const num = typeof cell === "number";
            const parsable =
              typeof cell === "string" &&
              cell.trim() !== "" &&
              !Number.isNaN(Number(cell.trim()));
            if (num || parsable) count++;
          }
        }
      }
    } else {
      if (nonBlank) {
        if (v !== "") count++;
      } else if (typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))) {
        count++;
      }
    }
  }
  return count;
}

type FnImpl = (args: EvalValue[]) => EvalValue;

const FUNCTIONS: Record<string, FnImpl> = {
  SUM: (a) => collectNumbers(a).reduce((s, x) => s + x, 0),
  PRODUCT: (a) => collectNumbers(a).reduce((s, x) => s * x, 1),
  AVERAGE: (a) => {
    const nums = collectNumbers(a);
    if (nums.length === 0) throw new FormulaError("#DIV/0!");
    return nums.reduce((s, x) => s + x, 0) / nums.length;
  },
  AVG: (a) => FUNCTIONS.AVERAGE(a),
  MIN: (a) => {
    const nums = collectNumbers(a);
    return nums.length ? Math.min(...nums) : 0;
  },
  MAX: (a) => {
    const nums = collectNumbers(a);
    return nums.length ? Math.max(...nums) : 0;
  },
  COUNT: (a) => countValues(a, false),
  COUNTA: (a) => countValues(a, true),
  ABS: (a) => Math.abs(toNumber(arg(a, 0))),
  SQRT: (a) => {
    const x = toNumber(arg(a, 0));
    if (x < 0) throw new FormulaError("#NUM!");
    return Math.sqrt(x);
  },
  ROUND: (a) => {
    const x = toNumber(arg(a, 0));
    const d = a.length > 1 ? toNumber(arg(a, 1)) : 0;
    const f = Math.pow(10, d);
    return Math.round(x * f) / f;
  },
  FLOOR: (a) => Math.floor(toNumber(arg(a, 0))),
  CEILING: (a) => Math.ceil(toNumber(arg(a, 0))),
  INT: (a) => Math.trunc(toNumber(arg(a, 0))),
  MOD: (a) => {
    const b = toNumber(arg(a, 1));
    if (b === 0) throw new FormulaError("#DIV/0!");
    return toNumber(arg(a, 0)) % b;
  },
  POWER: (a) => Math.pow(toNumber(arg(a, 0)), toNumber(arg(a, 1))),
  PI: () => Math.PI,
  IF: (a) => {
    const cond = toBool(arg(a, 0));
    return cond ? arg(a, 1) : a.length > 2 ? arg(a, 2) : false;
  },
  AND: (a) => collectFlags(a).every(Boolean),
  OR: (a) => collectFlags(a).some(Boolean),
  NOT: (a) => !toBool(arg(a, 0)),
  CONCAT: (a) => concatArgs(a),
  CONCATENATE: (a) => concatArgs(a),
  LEN: (a) => toStr(arg(a, 0)).length,
  LOWER: (a) => toStr(arg(a, 0)).toLowerCase(),
  UPPER: (a) => toStr(arg(a, 0)).toUpperCase(),
  TRIM: (a) => toStr(arg(a, 0)).trim(),
};

function arg(args: EvalValue[], i: number): EvalValue {
  if (i >= args.length) throw new FormulaError("#N/A", "Missing argument");
  return args[i];
}

function collectFlags(args: EvalValue[]): boolean[] {
  const out: boolean[] = [];
  for (const v of args) {
    if (isRange(v)) {
      for (const row of v.values) for (const c of row) out.push(toBool(c));
    } else {
      out.push(toBool(v));
    }
  }
  return out;
}

function concatArgs(args: EvalValue[]): string {
  let out = "";
  for (const v of args) {
    if (isRange(v)) {
      for (const row of v.values) for (const c of row) out += toStr(c);
    } else {
      out += toStr(v);
    }
  }
  return out;
}

interface EvalContext {
  sheet: Sheet;
  cache: Map<string, CellValue>;
  visiting: Set<string>;
}

function evalNode(node: Node, ctx: EvalContext): EvalValue {
  switch (node.kind) {
    case "num":
      return node.value;
    case "str":
      return node.value;
    case "bool":
      return node.value;
    case "ref":
      return resolveRef(node.ref, ctx);
    case "range":
      return resolveRange(node.from, node.to, ctx);
    case "unary": {
      if (node.op === "%") return toNumber(evalNode(node.operand, ctx)) / 100;
      const v = toNumber(evalNode(node.operand, ctx));
      return node.op === "-" ? -v : v;
    }
    case "binary":
      return evalBinary(node, ctx);
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new FormulaError("#NAME?", `Unknown function ${node.name}`);
      const args = node.args.map((a) => evalNode(a, ctx));
      return fn(args);
    }
  }
}

function evalBinary(
  node: Extract<Node, { kind: "binary" }>,
  ctx: EvalContext,
): EvalValue {
  const { op } = node;

  if (op === "&") {
    return toStr(evalNode(node.left, ctx)) + toStr(evalNode(node.right, ctx));
  }

  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
    const l = evalNode(node.left, ctx);
    const r = evalNode(node.right, ctx);
    return compare(op, l, r);
  }

  const a = toNumber(evalNode(node.left, ctx));
  const b = toNumber(evalNode(node.right, ctx));
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new FormulaError("#DIV/0!");
      return a / b;
    case "^":
      return Math.pow(a, b);
    default:
      throw new FormulaError("#ERROR!", `Unknown operator ${op}`);
  }
}

function compare(op: string, l: EvalValue, r: EvalValue): boolean {
  // Numeric compare when both look numeric, else string compare.
  const bothNumeric =
    (typeof l === "number" || (typeof l === "string" && l.trim() !== "" && !Number.isNaN(Number(l)))) &&
    (typeof r === "number" || (typeof r === "string" && r.trim() !== "" && !Number.isNaN(Number(r))));

  let a: number | string;
  let b: number | string;
  if (bothNumeric) {
    a = toNumber(l);
    b = toNumber(r);
  } else {
    a = toStr(l);
    b = toStr(r);
  }

  switch (op) {
    case "=":
      return a === b;
    case "<>":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case ">=":
      return a >= b;
    default:
      throw new FormulaError("#ERROR!");
  }
}

function resolveRef(ref: string, ctx: EvalContext): CellValue {
  const coord = refToCoord(ref);
  if (!coord) throw new FormulaError("#REF!", `Bad reference ${ref}`);

  if (ctx.cache.has(ref)) return ctx.cache.get(ref)!;
  if (ctx.visiting.has(ref)) throw new FormulaError("#CIRC!", "Circular reference");

  const raw = ctx.sheet.get(ref);
  if (raw === undefined || raw === "") {
    ctx.cache.set(ref, "");
    return "";
  }

  if (raw[0] === "=") {
    ctx.visiting.add(ref);
    try {
      const parsed = new Parser(tokenize(raw.slice(1))).parse();
      const result = evalNode(parsed, ctx);
      const value = isRange(result) ? "#VALUE!" : result;
      ctx.cache.set(ref, value as CellValue);
      return value as CellValue;
    } finally {
      ctx.visiting.delete(ref);
    }
  }

  // Literal: number if it parses cleanly, else string.
  const num = Number(raw);
  const value: CellValue = raw.trim() !== "" && !Number.isNaN(num) ? num : raw;
  ctx.cache.set(ref, value);
  return value;
}

function resolveRange(from: string, to: string, ctx: EvalContext): RangeValue {
  const a = refToCoord(from);
  const b = refToCoord(to);
  if (!a || !b) throw new FormulaError("#REF!", "Bad range");
  const r1 = Math.min(a.row, b.row);
  const r2 = Math.max(a.row, b.row);
  const c1 = Math.min(a.col, b.col);
  const c2 = Math.max(a.col, b.col);
  const values: CellValue[][] = [];
  for (let r = r1; r <= r2; r++) {
    const row: CellValue[] = [];
    for (let c = c1; c <= c2; c++) {
      row.push(resolveRef(colToLabel(c) + (r + 1), ctx));
    }
    values.push(row);
  }
  return { __range: true, values };
}

export interface DisplayResult {
  text: string;
  error: boolean;
  numeric: boolean;
}

/**
 * Compute the display value for a single cell given the whole sheet.
 * A shared cache can be passed to avoid recomputing shared dependencies.
 */
export function evaluateCell(
  ref: string,
  sheet: Sheet,
  cache: Map<string, CellValue> = new Map(),
): DisplayResult {
  const raw = sheet.get(ref);
  if (raw === undefined || raw === "") return { text: "", error: false, numeric: false };

  if (raw[0] !== "=") {
    const num = Number(raw);
    const numeric = raw.trim() !== "" && !Number.isNaN(num);
    return { text: raw, error: false, numeric };
  }

  const ctx: EvalContext = { sheet, cache, visiting: new Set() };
  try {
    const parsed = new Parser(tokenize(raw.slice(1))).parse();
    const result = evalNode(parsed, ctx);
    if (isRange(result)) return { text: "#VALUE!", error: true, numeric: false };
    if (typeof result === "number") {
      if (!Number.isFinite(result)) return { text: "#NUM!", error: true, numeric: false };
      return { text: formatNumber(result), error: false, numeric: true };
    }
    if (typeof result === "boolean") {
      return { text: result ? "TRUE" : "FALSE", error: false, numeric: false };
    }
    return { text: result, error: false, numeric: false };
  } catch (err) {
    const code = err instanceof FormulaError ? err.code : "#ERROR!";
    return { text: code, error: true, numeric: false };
  }
}
