// The hero: Aski at home over a composer. Words sent from the composer leave
// it as letters and pour into Aski; Aski winds up and throws. Its eyes follow
// what flies, then your pointer; its letters stir where you point. The Cells
// it throws load after it (`throws.ts`), so Aski is on the page at once.

import {
  BLINK,
  blinkFrom,
  BODY_HEIGHT,
  CELL_ASPECT,
  EYES,
  type Fit,
  GAZE,
  type Grid,
  restDistance,
} from "./app.ts";
import { WordField } from "./field.ts";
import { CH, CW, Stage } from "./stagekit.ts";
import { type EyeLook, playWhileSeen, reduced } from "./theater.ts";

/** A stage this narrow (CSS pixels) puts Aski in the middle, its Cells either side. */
export const NARROW = 620;

export interface Hero {
  readonly box: HTMLElement;
  readonly stage: Stage;
  readonly input: HTMLInputElement;
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
  const hint = root.querySelector<HTMLElement>(".hint")!;
  const title = root.querySelector<HTMLElement>("h1")!;
  const narrow = () => box.clientWidth < NARROW;
  const stage = new Stage(box, (grid): Fit => {
    const ky = (grid.rows * (narrow() ? 0.42 : 0.44)) / BODY_HEIGHT;
    return {
      cx: grid.cols * (narrow() ? 0.5 : 0.25),
      ground: grid.rows * (narrow() ? 0.6 : 0.66),
      kx: ky / CELL_ASPECT,
      ky,
    };
  });
  const field = new WordField(root.querySelector<HTMLCanvasElement>(".field")!);

  let clock = 0;
  let nextBlink = 2.5;
  const throwsAt: number[] = [];
  const look = { x: 0, y: 0, toX: 0, toY: 0 };
  /** The pointer over the stage, in cells; NaN while away. */
  const pointer = { i: Number.NaN, j: Number.NaN };
  const queued: string[] = [];

  const floor = () => stage.ground / stage.d;
  /** The composer sits under the ground line, under Aski; the hint under it. */
  const place = () => {
    const width = stage.width / stage.d;
    const left = stage.back.offsetLeft - width / 2;
    const span = narrow() ? width * 0.9 : Math.min(420, width * 0.46);
    const x = narrow() ? left + width * 0.05 : left + (stage.fit.cx * CW) / stage.d - span / 2;
    form.style.left = `${Math.max(8, x)}px`;
    form.style.width = `${span}px`;
    form.style.top = `${floor() + (narrow() ? 22 : 36)}px`;
    hint.style.left = `${Math.max(8, x) + 4}px`;
    hint.style.top = `${floor() + (narrow() ? 22 : 36) + form.offsetHeight + 10}px`;
    const canvas = stage.back.getBoundingClientRect();
    const { fit } = stage;
    field.keepClear((px, py) => {
      const i = ((px - canvas.left) * stage.d) / CW,
        j = ((py - canvas.top) * stage.d) / CH;
      return restDistance((i - fit.cx) / fit.kx, (j - fit.ground) / fit.ky) < 12;
    });
  };
  new ResizeObserver(() => {
    field.layout();
    place();
  }).observe(root);

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

  /** The ground: a line of dots the Cells land on. */
  const ground = () => {
    const context = stage.context;
    const y = Math.round(stage.ground) + 2;
    context.fillStyle = "rgba(237, 233, 224, 0.22)";
    for (let x = CW; x < stage.width; x += CW * 3) context.fillRect(x, y, 2, 2);
  };

  const api: Hero = {
    box,
    stage,
    input,
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
    else if (document.activeElement === input) lookToward(fit.cx, fit.ground + 12);
    else if (!Number.isNaN(pointer.i)) lookToward(pointer.i, pointer.j);
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
    field.tick(now);
    stage.clear();
    ground();
    api.onFrame(now, dt);
    stage.drawLetters(now);
    paintAski(now);
  };

  stage.onResize = () => {
    stage.fliers.length = 0;
    place();
    if (reduced) frame(0, 0);
  };
  place();
  field.canvas.classList.add("on");
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
