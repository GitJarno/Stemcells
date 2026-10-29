// The hero's ground: a field of the things people hand their Cells, in Aski's
// font at a low, uneven ink, one phrase now and then catching the light. A
// phrase can be lifted out (it flies home into Aski) and comes back later.

import { type Grid, makeGrid } from "./app.ts";
import { GridView } from "./theater.ts";

const ASKS = [
  "fix the flaky test",
  "add dark mode",
  "write the docs",
  "ship it",
  "migrate the db",
  "refactor auth",
  "bump deps",
  "triage issues",
  "speed up search",
  "add a cache",
  "make it accessible",
  "port to rust",
  "trim the bundle",
  "add retries",
  "tidy the logs",
  "write a changelog",
  "review the pr",
  "add an export",
  "fix the typo",
  "split this file",
  "rename the api",
  "add pagination",
  "cover the edge case",
  "draw an icon",
  "localize it",
  "find the leak",
  "pin the version",
  "add a webhook",
  "make onboarding nicer",
  "answer the issue",
  "prune dead code",
  "stream the response",
  "add a shortcut",
  "index the table",
  "sign the build",
  "kill the warning",
  "add a dry run",
  "make the tests green",
  "write a migration",
  "profile it",
  "add undo",
  "fix the race",
  "debounce the input",
  "add a health check",
  "shrink the image",
  "add a filter",
  "explain this function",
  "reduce the cold start",
  "move it to a worker",
  "add a feature flag",
  "fix the layout shift",
  "batch the writes",
  "add rate limits",
];

interface Phrase {
  readonly text: string;
  /** Its cells, as grid indices, letters only. */
  readonly cells: readonly number[];
  ink: number;
  hidden: boolean;
}

export class WordField {
  readonly canvas: HTMLCanvasElement;
  #view!: GridView;
  #grid!: Grid;
  #phrases: Phrase[] = [];
  #twinkle: { phrase: Phrase; from: number; peak: number; at: number } | null = null;
  #next = 0;
  #back: { phrase: Phrase; at: number }[] = [];
  /** Cells kept clear, around Aski. */
  #clear = new Set<number>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.layout();
  }

  layout(): void {
    const box = this.canvas.parentElement!;
    this.#view = new GridView(this.canvas, box.clientWidth, box.clientHeight);
    const { cols, rows } = this.#view.stage;
    this.#grid = makeGrid(this.#view.stage);
    this.#phrases = [];
    let k = 0,
      n = Math.floor(Math.random() * ASKS.length);
    while (k < cols * rows) {
      const text = ASKS[n++ % ASKS.length]!;
      const cells: number[] = [];
      for (const ch of text) {
        if (k >= cols * rows) break;
        if (ch !== " ") cells.push(k);
        this.#grid.cells[k] = { ch, ink: 0 };
        k++;
      }
      k++;
      const lit = Math.random() < 0.05;
      const phrase = {
        text,
        cells,
        ink: lit ? 0.3 + Math.random() * 0.12 : 0.06 + Math.random() * 0.1,
        hidden: false,
      };
      this.#phrases.push(phrase);
      this.#ink(phrase, phrase.ink);
    }
    this.#view.draw(this.#grid);
  }

  #ink(phrase: Phrase, ink: number): void {
    for (const k of phrase.cells)
      this.#grid.cells[k] = { ch: this.#grid.cells[k]!.ch, ink: this.#clear.has(k) ? 0 : ink };
  }

  /** Keeps every cell whose middle `clear` says (client pixels) empty, so Aski stands in a hole of its own. */
  keepClear(clear: (x: number, y: number) => boolean): void {
    const rect = this.canvas.getBoundingClientRect();
    const { cols, rows } = this.#view.stage;
    this.#clear = new Set();
    for (let k = 0; k < cols * rows; k++) {
      const x = rect.left + (((k % cols) + 0.5) / cols) * rect.width,
        y = rect.top + ((Math.floor(k / cols) + 0.5) / rows) * rect.height;
      if (clear(x, y)) this.#clear.add(k);
    }
    for (const p of this.#phrases) if (!p.hidden) this.#ink(p, p.ink);
    this.#view.draw(this.#grid);
  }

  /** A phrase whose letters all sit where `fits` says, client pixels, to lift out. */
  lift(fits: (x: number, y: number) => boolean): { text: string; at: [number, number][] } | null {
    const rect = this.canvas.getBoundingClientRect();
    const { cols, rows } = this.#view.stage;
    const at = (k: number): [number, number] => [
      rect.left + (((k % cols) + 0.5) / cols) * rect.width,
      rect.top + ((Math.floor(k / cols) + 0.5) / rows) * rect.height,
    ];
    const fitting = this.#phrases.filter(
      (p) =>
        !p.hidden &&
        p.cells.length > 3 &&
        p.cells.length < 14 &&
        p.cells.every((k) => !this.#clear.has(k) && fits(...at(k))),
    );
    const phrase = fitting[Math.floor(Math.random() * fitting.length)];
    if (phrase === undefined) return null;
    phrase.hidden = true;
    this.#ink(phrase, 0);
    this.#back.push({ phrase, at: performance.now() / 1000 + 9 });
    return { text: phrase.text.replaceAll(" ", ""), at: phrase.cells.map(at) };
  }

  /** One phrase at a time catches the light and lets it go; lifted ones come back. */
  tick(now: number): void {
    const back = this.#back.find((b) => performance.now() / 1000 > b.at);
    if (back !== undefined) {
      back.phrase.hidden = false;
      this.#ink(back.phrase, back.phrase.ink);
      this.#back.splice(this.#back.indexOf(back), 1);
    } else if (this.#twinkle === null && now > this.#next) {
      const phrase = this.#phrases[Math.floor(Math.random() * this.#phrases.length)]!;
      if (!phrase.hidden)
        this.#twinkle = { phrase, from: phrase.ink, peak: 0.45 + Math.random() * 0.2, at: now };
      this.#next = now + 0.5 + Math.random() * 0.9;
    } else if (this.#twinkle !== null) {
      const { phrase, from, peak, at } = this.#twinkle;
      const u = (now - at) / 1.6;
      if (u >= 1 || phrase.hidden) {
        if (!phrase.hidden) this.#ink(phrase, from);
        this.#twinkle = null;
      } else this.#ink(phrase, from + (peak - from) * Math.sin(Math.PI * u));
    }
    this.#view.draw(this.#grid);
  }
}
