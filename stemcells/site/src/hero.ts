// The hero: Aski's pond, as the app plays it once every Cell has landed, ending
// with Aski at home. At home its eyes follow you, its letters stir where you
// point, and now and then a Cell's word comes home in the Cell's colour and
// sinks into its skin. A click plays another of its scenes.

import {
  BLINK,
  blinkFrom,
  BODY_HEIGHT,
  CELL_PALETTE,
  restDistance,
  EYES,
  eyesLooking,
  GAZE,
  type Grid,
  POND,
  SCENE_CARDS,
  SCENE_TIMES,
  type SceneCard,
} from "./app.ts";
import { WordField } from "./field.ts";
import { CH, CW, Stage } from "./stagekit.ts";
import { eyesOf, playWhileSeen, reduced } from "./theater.ts";

/** What a click plays next, at home. */
const ENCORES = ["the-rain", "the-pond"] as const;

interface Playing {
  readonly id: string;
  readonly card: SceneCard;
  /** Play time when it started, and the scene time it started at. */
  readonly began: number;
  readonly from: number;
  said: boolean;
}

export function hero(root: HTMLElement): void {
  const box = root.querySelector<HTMLElement>(".hero-stage")!;
  const say = root.querySelector<HTMLElement>(".say")!;
  const title = root.querySelector<HTMLElement>("h1")!;
  const stage = new Stage(box);
  const field = new WordField(root.querySelector<HTMLCanvasElement>(".field")!);
  /** Clears the field where Aski stands at home, and a little round it. */
  const clearAski = () => {
    const canvas = stage.back.getBoundingClientRect();
    const { fit } = stage;
    field.keepClear((x, y) => {
      const i = ((x - canvas.left) * stage.d) / CW,
        j = ((y - canvas.top) * stage.d) / CH;
      return restDistance((i - fit.cx) / fit.kx, (j - fit.ground) / fit.ky) < 9;
    });
  };
  new ResizeObserver(() => {
    field.layout();
    clearAski();
  }).observe(root);
  const bodies = Object.values(CELL_PALETTE.bodies).map((inks) => inks.B);

  let clock = 0;
  let playing: Playing | null = null;
  let encore = 0;
  let nextBlink = 3;
  let nextGift = 4;
  let sayUntil = 0;
  const look = { x: 0, y: 0, toX: 0, toY: 0 };
  /** The pointer over the stage, in cells; NaN while away. */
  const pointer = { i: Number.NaN, j: Number.NaN };

  const play = (id: string, from = 0) => {
    const card = SCENE_CARDS[id]!({ seed: 7 });
    playing = { id, card, began: clock, from, said: false };
    stage.fliers.length = 0;
  };
  const speak = (line: string) => {
    say.textContent = line;
    say.classList.add("on");
    sayUntil = clock + 3.8;
  };

  root.addEventListener("pointermove", (event) => {
    const rect = stage.back.getBoundingClientRect();
    const i = ((event.clientX - rect.left) / rect.width) * stage.view.stage.cols;
    const j = ((event.clientY - rect.top) / rect.height) * stage.view.stage.rows;
    pointer.i = i;
    pointer.j = j;
    const { fit } = stage;
    const eyeX = ((EYES.centers[0][0] + EYES.centers[1][0]) / 2) * fit.kx + fit.cx;
    const eyeY = EYES.centers[0][1] * fit.ky + fit.ground;
    const dx = i - eyeX,
      dy = (j - eyeY) * 2;
    const far = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, far / 40);
    look.toX = (dx / far) * GAZE.x * reach;
    look.toY = (dy / far) * GAZE.y * reach;
  });
  root.addEventListener("pointerleave", () => {
    look.toX = 0;
    look.toY = 0;
    pointer.i = Number.NaN;
  });

  box.addEventListener("click", () => {
    const now = playing;
    if (now?.id === "the-pond" && clock - now.began + now.from < POND.back) {
      playing = { ...now, began: clock, from: POND.back, said: true };
      return;
    }
    if (now !== null) return;
    field.canvas.classList.remove("on");
    play(ENCORES[encore % ENCORES.length]!);
    encore += 1;
  });

  // The headline's two words trade places, measured, then trade their text so it stays put on resize.
  const swapTitle = once(() => {
    const a = title.querySelector<HTMLElement>(".a")!,
      b = title.querySelector<HTMLElement>(".b")!;
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

  /** Something someone asked for lights up in a Cell's colour, lifts out of the field, and goes home into Aski. */
  const gift = () => {
    const area = box.getBoundingClientRect(),
      canvas = stage.back.getBoundingClientRect();
    const [ax, ay] = stage.point(31, -BODY_HEIGHT / 2);
    const middle = [canvas.left + ax / stage.d, canvas.top + ay / stage.d] as const;
    const reach = (BODY_HEIGHT * stage.fit.ky * CH) / stage.d;
    const lifted = field.lift(
      (x, y) =>
        x > area.left + 10 &&
        x < area.right - 10 &&
        y > area.top + 10 &&
        y < Math.min(area.bottom, innerHeight) - 30 &&
        Math.hypot(x - middle[0], (y - middle[1]) * 1.4) > reach * 0.75,
    );
    if (lifted === null) return;
    const colour = bodies[Math.floor(Math.random() * bodies.length)]!;
    [...lifted.text].forEach((ch, n) => {
      const [x, y] = lifted.at[n]!;
      stage.fliers.push({
        ch,
        colour,
        from: [(x - canvas.left) * stage.d, (y - canvas.top) * stage.d],
        to: stage.anySkin(),
        start: clock + 0.5 + n * 0.06,
        duration: 1.1 + Math.random() * 0.3,
        lift: -CH * (2 + Math.random() * 3),
      });
    });
  };

  /** Home, its letters turning over where the pointer rests. */
  const stirred = (): Grid => {
    if (Number.isNaN(pointer.i)) return stage.home;
    const { cols } = stage.view.stage;
    const turn = Math.floor(clock * 9);
    const cells = stage.home.cells.slice();
    for (const k of stage.skin) {
      const di = (k % cols) - pointer.i,
        dj = (Math.floor(k / cols) - pointer.j) * 2;
      const d = Math.hypot(di, dj);
      if (d > 9) continue;
      const shift = Math.floor((9 - d) / 3) + turn;
      cells[k] = { ...cells[k]!, ch: "aski"[(k + shift) % 4]! };
    }
    return { ...stage.home, cells };
  };

  const frame = (t: number) => {
    clock = t;
    if (sayUntil > 0 && clock > sayUntil) {
      say.classList.remove("on");
      sayUntil = 0;
    }
    if (playing !== null) {
      const at = playing.from + (clock - playing.began);
      const times = SCENE_TIMES[playing.id];
      if (!playing.said && times !== undefined && at >= times.say) {
        playing.said = true;
        speak(playing.card.lines[0] ?? times.line);
      }
      if (at < playing.card.end) {
        stage.clear();
        return stage.view.drawScene(playing.card, at);
      }
      playing = null;
      nextBlink = clock + 2.5;
      nextGift = clock + 3;
      swapTitle();
      clearAski();
      field.canvas.classList.add("on");
    }
    if (clock > nextBlink + BLINK.close + BLINK.open) nextBlink = clock + 2.4 + Math.random() * 4;
    if (clock > nextGift) {
      gift();
      nextGift = clock + 3.5 + Math.random() * 3;
    }
    field.tick(clock);
    look.x += (look.toX - look.x) * 0.12;
    look.y += (look.toY - look.y) * 0.12;
    const looking = Math.hypot(look.x, look.y) > 0.25;
    stage.clear();
    stage.drawLetters(clock);
    stage.paint(
      stirred(),
      {
        open: blinkFrom(clock, nextBlink),
        fit: stage.fit,
        at: looking ? eyesLooking(stage.view.stage, [look.x, look.y]) : null,
      },
      clock,
    );
  };

  stage.onResize = () => {
    stage.fliers.length = 0;
    if (reduced) still();
  };
  const still = () =>
    stage.view.draw(stage.home, eyesOf(SCENE_CARDS["the-pond"]!({}), POND.end, stage.view.stage));

  if (reduced) {
    still();
    swapTitle();
    clearAski();
    field.canvas.classList.add("on");
    return;
  }
  play("the-pond", POND.koi);
  playWhileSeen(box, frame);
}

function once(run: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    run();
  };
}
