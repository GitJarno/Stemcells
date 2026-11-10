/**
 * A `chart` fence, read: an optional `bar: <title>` or `line: <title>` line, then one markdown
 * table whose first column holds the labels and whose other columns are one series each. The
 * Mac and the phone both read a fence with this, so they agree on what draws and what falls back
 * to the fence as written (`stemcells/tasks/chart-fence.md`). Hermes runs it: no `toSorted`.
 */

export type ChartKind = "bar" | "line";

/** The most series a chart holds: a fifth column of numbers is a table, not a chart. */
export const MAX_SERIES = 4;

export interface ChartSeries {
  /** The column's header as written, unit and all: what a legend and a table say. */
  readonly header: string;
  /** The header without its unit. */
  readonly name: string;
  /** From the header's brackets, as in `Time (ms)`, else `%` when the cells carry it, else none. */
  readonly unit: string;
  readonly values: readonly number[];
  /** Each cell as written (`~1,200`, `<5`, `45%`), which is what a value's label says. */
  readonly texts: readonly string[];
}

export interface Chart {
  readonly kind: ChartKind;
  readonly title: string;
  /** The first column's header: what the labels are. */
  readonly labelHeader: string;
  readonly labels: readonly string[];
  readonly series: readonly ChartSeries[];
}

const KIND_LINE = /^(bar|line)\s*(?::\s*(.*))?$/i;
const DELIMITER_CELL = /^:?-+:?$/;
const UNIT = /^(.*\S)\s*\(([^()]+)\)$/;
const GROUPED = /^\d{1,3}(?:[,   ]\d{3})+(?:\.\d+)?$/;
const PLAIN = /^(?:\d+\.?\d*|\.\d+)$/;

/** A table row's cells; a pipe written `\|` stays in its cell. */
function cellsOf(line: string): string[] | null {
  if (!line.includes("|")) return null;
  const cells: string[] = [];
  let cell = "";
  for (let at = 0; at < line.length; at += 1) {
    const char = line[at]!;
    if (char === "\\" && line[at + 1] === "|") {
      cell += "|";
      at += 1;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  // The pipes at a row's ends frame it; they hold no cell.
  if (line.startsWith("|")) cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

/** A cell's words without the marks that only style them. */
function plain(cell: string): string {
  return cell.replace(/^(\*\*|__|`)(.+)\1$/, "$2");
}

function numberOf(cell: string): number | null {
  let text = plain(cell);
  if (text.endsWith("%")) text = text.slice(0, -1).trimEnd();
  text = text.replace(/^[~<>]\s*/, "");
  const sign = /^[-−]/.test(text) ? -1 : 1;
  text = text.replace(/^[-+−]/, "");
  if (GROUPED.test(text)) text = text.replace(/[,   ]/g, "");
  else if (!PLAIN.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? sign * value : null;
}

/** What a `chart` fence holds, or null when it doesn't read as one and is shown as written. */
export function parseChart(source: string): Chart | null {
  const lines = source.split(/\r?\n/).map((line) => line.trim());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  let at = lines.findIndex((line) => line !== "");
  if (at === -1) return null;

  let kind: ChartKind = "bar";
  let title = "";
  const first = KIND_LINE.exec(lines[at]!);
  if (first !== null) {
    kind = first[1]!.toLowerCase() === "line" ? "line" : "bar";
    title = (first[2] ?? "").trim();
    at += 1;
    while (lines[at] === "") at += 1;
  }

  const head = cellsOf(lines[at] ?? "");
  const rule = cellsOf(lines[at + 1] ?? "");
  const rows = lines.slice(at + 2).map(cellsOf);
  if (head === null || rule === null || rows.length === 0) return null;
  const columns = head.length;
  if (columns < 2 || columns > MAX_SERIES + 1) return null;
  if (rule.length !== columns || !rule.every((cell) => DELIMITER_CELL.test(cell))) return null;

  const labels: string[] = [];
  const values: number[][] = head.slice(1).map(() => []);
  const texts: string[][] = head.slice(1).map(() => []);
  for (const row of rows) {
    if (row === null || row.length !== columns) return null;
    labels.push(plain(row[0]!));
    for (let column = 1; column < columns; column += 1) {
      const value = numberOf(row[column]!);
      if (value === null) return null;
      values[column - 1]!.push(value);
      texts[column - 1]!.push(plain(row[column]!));
    }
  }

  return {
    kind,
    title,
    labelHeader: plain(head[0]!),
    labels,
    series: head.slice(1).map((cell, index) => {
      const header = plain(cell);
      const unit = UNIT.exec(header);
      const percent = texts[index]!.some((text) => text.endsWith("%"));
      return {
        header,
        name: unit?.[1] ?? header,
        unit: unit?.[2]?.trim() ?? (percent ? "%" : ""),
        values: values[index]!,
        texts: texts[index]!,
      };
    }),
  };
}
