// The hero: Aski stands on the app's own window, beside a composer. Sent words
// pour into Aski as letters; it winds up and throws, and what it throws lands
// along the window's top edge. Its eyes follow what flies, then your pointer.
// The Cells it throws load after it (`throws.ts`), so Aski is up at once.

import {
  BLINK,
  blinkFrom,
  BODY_HEIGHT,
  CELL_ASPECT,
  EYES,
  type Fit,
  GAZE,
  type Grid,
} from "./app.ts";
import { Exhibit } from "./kit/exhibit.ts";
import { formOf } from "./kit/form.ts";
import { CH, CW, Stage } from "./stagekit.ts";
import { density, type EyeLook, playWhileSeen, reduced } from "./theater.ts";

export interface Hero {
  readonly box: HTMLElement;
  readonly stage: Stage;
  readonly input: HTMLInputElement;
  /** A hand's layout: the words above, Aski in the middle of the ledge, its Cells either side. */
  narrow(): boolean;
  /** Seconds of play. */
  now(): number;
  /** The ground line, CSS pixels down the stage. */
  floor(): number;
  /** Where a throw leaves Aski, CSS pixels on the stage. */
  launch(): readonly [number, number];
  /** The sent words leave the composer as letters in `colour` and pour into Aski. Returns when the last has landed. */
  pour(text: string, colour: string): number;
  /** Aski winds up and lets go at `at`. */
  throwAt(at: number): void;
  /** The headline's two words trade places, once. */
  swapTitle(): void;
  /** Draws the stage once more as it stands: Reduce Motion's still, after something changed. */
  redraw(): void;
  /** Drawn each frame over the cleared stage, under Aski's letters. */
  onFrame: (now: number, dt: number) => void;
  /** Called with what the composer sent. */
  onSend: ((text: string) => void) | null;
  /** What Aski watches, CSS pixels on the stage; null lets it watch the pointer. */
  watch: () => readonly [number, number] | null;
}

export function hero(root: HTMLElement): Hero {
  const box = root.querySelector<HTMLElement>(".hero-stage")!;
  const form = root.querySelector<HTMLFormElement>(".tell")!;
  const input = form.querySelector<HTMLInputElement>("input")!;
  const title = root.querySelector<HTMLElement>("h1")!;
  const narrow = () => formOf(innerWidth, innerHeight) !== "desk";
  // The stage's foot is the window's top edge: whatever stands on the stage stands on the app.
  const stage = new Stage(box, (grid): Fit => {
    // In a hand the stage runs behind the words too: Aski is sized to the band under them.
    const band = (innerHeight * 0.34 * density()) / CH;
    const ky = (narrow() ? Math.min(grid.rows, band) * 0.66 : grid.rows * 0.5) / BODY_HEIGHT;
    return {
      cx: grid.cols * (narrow() ? 0.5 : 0.62),
      ground: grid.rows - 0.2,
      kx: ky / CELL_ASPECT,
      ky,
    };
  });
  // The window under the stage, as each kind of screen shows the app: the stylesheet shows one, and only that one loads.
  const host = root.querySelector<HTMLElement>(".hero-app")!;
  const first = { desk: "desk", tablet: "pad", phone: "hand" }[formOf(innerWidth, innerHeight)];
  for (const [on, shot] of [
    ["desk", "crew"],
    ["pad", "narrow-tablet"],
    ["hand", "narrow-phone"],
  ] as const) {
    const app = new Exhibit(host, [shot], { on, eager: on === first });
    // In a hand the window is the app at that width, from its top, cut where the fold would cut it.
    app.look(on === "desk" ? null : { x: 0, y: 0, w: app.screen.w, h: 10 });
  }

  let clock = 0;
  let nextBlink = 2.5;
  const throwsAt: number[] = [];
  const look = { x: 0, y: 0, toX: 0, toY: 0 };
  /** The pointer over the stage, in cells; NaN while away. */
  const pointer = { i: Number.NaN, j: Number.NaN };
  const queued: string[] = [];

  const floor = () => stage.ground / stage.d;
  const lookToward = (i: number, j: number) => {
    const { fit } = stage;
    const eyeX = ((EYES.centers[0][0] + EYES.centers[1][0]) / 2) * fit.kx + fit.cx;
    const eyeY = EYES.centers[0][1] * fit.ky + fit.ground;
    const dx = i - eyeX,
      dy = (j - eyeY) * 2;
    const far = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, far / 40);
    look.toX = (dx / far) * GAZE.x * reach;
    look.toY = (dy / far) * GAZE.y * reach;
  };
  root.addEventListener("pointermove", (event) => {
    const rect = stage.back.getBoundingClientRect();
    pointer.i = ((event.clientX - rect.left) / rect.width) * stage.view.stage.cols;
    pointer.j = ((event.clientY - rect.top) / rect.height) * stage.view.stage.rows;
  });
  root.addEventListener("pointerleave", () => {
    pointer.i = Number.NaN;
  });

  const swapTitle = once(() => {
    const a = title.querySelector<HTMLElement>(".a")!,
      b = title.querySelector<HTMLElement>(".b")!;
    if (reduced) {
      [a.textContent, b.textContent] = [b.textContent, a.textContent];
      return;
    }
    const ra = a.getBoundingClientRect(),
      rb = b.getBoundingClientRect();
    b.style.transform = `translateX(${ra.left - rb.left}px)`;
    a.style.transform = `translateX(${rb.right - ra.right}px)`;
    a.addEventListener(
      "transitionend",
      () => {
        [a.textContent, b.textContent] = [b.textContent, a.textContent];
        for (const w of [a, b]) {
          w.style.transition = "none";
          w.style.transform = "";
          void w.offsetWidth;
          w.style.transition = "";
        }
      },
      { once: true },
    );
  });

  /** Home, its letters turning over where the pointer rests. */
  const stirred = (home: Grid): Grid => {
    if (Number.isNaN(pointer.i)) return home;
    const { cols } = stage.view.stage;
    const turn = Math.floor(clock * 9);
    const cells = home.cells.slice();
    for (const k of stage.skin) {
      const di = (k % cols) - pointer.i,
        dj = (Math.floor(k / cols) - pointer.j) * 2;
      const d = Math.hypot(di, dj);
      if (d > 9) continue;
      cells[k] = { ...cells[k]!, ch: "aski"[(k + Math.floor((9 - d) / 3) + turn) % 4]! };
    }
    return { ...home, cells };
  };

  const api: Hero = {
    box,
    stage,
    input,
    narrow,
    now: () => clock,
    floor,
    launch: () => {
      const [x, y] = stage.point(74, -150);
      return [x / stage.d, y / stage.d];
    },
    pour(text, colour) {
      const rect = input.getBoundingClientRect(),
        canvas = stage.back.getBoundingClientRect();
      const letters = [...text];
      // The input's own type is 16px monospace: its characters stand 0.6 of that apart.
      const advance = 16 * 0.602;
      let last = clock;
      letters.forEach((ch, n) => {
        if (ch === " ") return;
        const start = clock + n * 0.035;
        const duration = 0.72 + ((n * 37) % 10) * 0.022;
        last = Math.max(last, start + duration);
        stage.fliers.push({
          ch,
          colour,
          from: [
            (rect.left + Math.min(rect.width - 8, (n + 0.5) * advance) - canvas.left) * stage.d,
            (rect.top + rect.height / 2 - canvas.top) * stage.d,
          ],
          to: stage.anySkin(),
          start,
          duration,
          lift: -CH * (2 + (n % 4)),
        });
      });
      return last;
    },
    throwAt: (at) => {
      throwsAt.push(at);
    },
    swapTitle,
    redraw: () => frame(clock, 0),
    onFrame: () => {},
    onSend: null,
    watch: () => null,
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text === "") return;
    input.value = "";
    if (api.onSend === null) queued.push(text);
    else api.onSend(text);
  });
  queueMicrotask(function flush() {
    if (api.onSend === null) return void setTimeout(flush, 120);
    for (const text of queued.splice(0)) api.onSend(text);
  });

  const paintAski = (now: number) => {
    // A wind-up before each throw, a stretch as it lets go.
    let squash = 0;
    for (let n = throwsAt.length - 1; n >= 0; n--) {
      const u = now - throwsAt[n]!;
      if (u > 0.4) throwsAt.splice(n, 1);
      else if (u > -0.28 && u < 0) squash = -0.09 * Math.sin(((u + 0.28) / 0.28) * (Math.PI / 2));
      else if (u >= 0) squash = 0.06 * Math.sin((u / 0.4) * Math.PI);
    }
    const base = stage.fit;
    const fit: Fit =
      squash === 0
        ? base
        : { ...base, ky: base.ky * (1 + squash), kx: base.kx * (1 - squash * 0.7) };
    const watched = api.watch();
    if (watched !== null) lookToward((watched[0] * stage.d) / CW, (watched[1] * stage.d) / CH);
    else if (document.activeElement === input) {
      const field = input.getBoundingClientRect(),
        canvas = stage.back.getBoundingClientRect();
      lookToward(
        ((field.left + field.width / 2 - canvas.left) * stage.d) / CW,
        ((field.top - canvas.top) * stage.d) / CH,
      );
    } else if (!Number.isNaN(pointer.i)) lookToward(pointer.i, pointer.j);
    else {
      look.toX = 0;
      look.toY = 0;
    }
    look.x += (look.toX - look.x) * 0.14;
    look.y += (look.toY - look.y) * 0.14;
    if (now > nextBlink + BLINK.close + BLINK.open) nextBlink = now + 2.4 + Math.random() * 4;
    const eyes: EyeLook = {
      open: blinkFrom(now, nextBlink),
      fit,
      at: {
        at: [
          [
            (EYES.centers[0][0] + look.x) * fit.kx + fit.cx,
            (EYES.centers[0][1] + look.y) * fit.ky + fit.ground,
          ],
          [
            (EYES.centers[1][0] + look.x) * fit.kx + fit.cx,
            (EYES.centers[1][1] + look.y) * fit.ky + fit.ground,
          ],
        ],
        rows: EYES.height * fit.ky,
      },
    };
    stage.paint(squash === 0 ? stirred(stage.home) : stage.cloudAt(fit), eyes, now);
  };

  const frame = (now: number, dt: number) => {
    clock = now;
    stage.clear();
    api.onFrame(now, dt);
    stage.drawLetters(now);
    paintAski(now);
  };

  stage.onResize = () => {
    stage.fliers.length = 0;
    if (reduced) frame(0, 0);
  };
  if (reduced) {
    swapTitle();
    // The Cells' still is drawn once they have loaded.
    requestAnimationFrame(() => frame(0, 0));
    return api;
  }
  playWhileSeen(box, frame);
  return api;
}

function once(run: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    run();
  };
}
