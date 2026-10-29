// 04 · Nothing is lost. A landed Cell says its last words and gives its
// characters back: its pixels turn into the letters of what it said, in its own
// colours, and they fly home into Aski's skin, fading into its ink. Aski is
// pleased, and buds the next Cell from them.

import { BLINK, blinkFrom, EYES, type Grid, MOODS } from "./app.ts";
import { Actor } from "./actors.ts";
import { type Bud, budCard, budsOf } from "./buds.ts";
import { crew, drawCell, rasterOf } from "./cells.ts";
import { CH, CW, glyphOf, Stage } from "./stagekit.ts";
import { type EyeLook, eyesOf, playWhileSeen, reduced } from "./theater.ts";

const LAST_WORDS = "Docs shipped. My letters are yours.";
const NEXT = "tests";
/** Seconds into the loop. */
const T = { say: 1, apart: 4.4, made: 4.8, fly: 5.8, end: 18 } as const;
/** CSS pixels an art pixel: big enough that the letters it becomes read as the Cell. */
const SIZE = 3;

interface Letter {
  readonly ch: string;
  readonly colour: string;
  readonly x: number;
  readonly y: number;
}

export function home(root: HTMLElement): void {
  const stage = new Stage(root);
  const [giver, next] = crew([
    ["Moose", "codex"],
    ["Pip", "claude"],
  ]) as [ReturnType<typeof crew>[number], ReturnType<typeof crew>[number]];
  const bubble = document.createElement("div");
  bubble.className = "say small";
  root.append(bubble);
  const card = budCard([NEXT]);

  let began = 0;
  let bud: Bud | undefined;
  let leaving: Actor;
  let born: Actor | null = null;
  let letters: Letter[] = [];
  let flown = false;
  let pleasedAt = -1;
  let budAt = -1;
  let nextBlink = 2;

  const d = () => stage.d;
  const reset = (now: number) => {
    bud = budsOf(stage, card, [NEXT])[0];
    const x = Math.min(stage.width / d() - 56, (bud?.x ?? stage.width * 0.84) / d());
    leaving = new Actor(giver, x, stage.ground / d());
    leaving.scale = SIZE;
    leaving.say("Landed", "landed");
    leaving.play("happy", now);
    born = null;
    letters = [];
    flown = false;
    pleasedAt = -1;
    budAt = -1;
    began = now;
    stage.fliers.length = 0;
    bubble.classList.remove("on");
  };

  /** The Cell's picture as letters on Aski's grid: a letter wherever its art covers a cell, in the art's colour there. */
  const apart = (now: number): Letter[] => {
    const frame = leaving.frame(now);
    const raster = rasterOf(frame, giver.body);
    const px = Math.max(1, Math.round(SIZE * d()));
    const w = raster.width * px,
      h = raster.height * px;
    const left = leaving.x * d() - w / 2,
      top = leaving.y * d() - h + 2 * px;
    const data = raster.getContext("2d")!.getImageData(0, 0, raster.width, raster.height).data;
    const words = LAST_WORDS.replace(/[^a-z]/gi, "").toLowerCase();
    const out: Letter[] = [];
    const i0 = Math.floor(left / CW),
      j0 = Math.floor(top / CH);
    for (let j = j0; j * CH < top + h; j++)
      for (let i = i0; i * CW < left + w; i++) {
        let r = 0,
          g = 0,
          b = 0,
          n = 0,
          all = 0;
        for (let y = j * CH; y < (j + 1) * CH; y += px)
          for (let x = i * CW; x < (i + 1) * CW; x += px) {
            all++;
            const ax = Math.floor((x - left) / px),
              ay = Math.floor((y - top) / px);
            if (ax < 0 || ay < 0 || ax >= raster.width || ay >= raster.height) continue;
            const o = (ay * raster.width + ax) * 4;
            if (data[o + 3]! < 128) continue;
            r += data[o]!;
            g += data[o + 1]!;
            b += data[o + 2]!;
            n++;
          }
        if (n < all * 0.3) continue;
        const hex = (v: number) =>
          Math.round(v / n)
            .toString(16)
            .padStart(2, "0");
        out.push({
          ch: words[out.length % words.length]!,
          colour: `#${hex(r)}${hex(g)}${hex(b)}`,
          x: (i + 0.5) * CW,
          y: (j + 0.5) * CH,
        });
      }
    return out;
  };

  const frame = (now: number, dt: number) => {
    const t = now - began;
    const context = stage.context;
    stage.clear();
    if (t >= T.say && t < T.apart - 0.4 && !bubble.classList.contains("on")) {
      bubble.textContent = LAST_WORDS;
      const [x, y] = stage.css(leaving.x * d(), (leaving.y - 124) * d());
      const half = bubble.offsetWidth / 2 + 10;
      bubble.style.left = `${Math.min(root.clientWidth - half, Math.max(half, x))}px`;
      bubble.style.top = `${y}px`;
      bubble.classList.add("on");
    }
    if (t >= T.apart - 0.4) bubble.classList.remove("on");
    if (leaving.key === "happy" && now - leaving.since > 1.6) leaving.play("idle", now);

    // The Cell, then its letters in its place, then its letters on their way home.
    if (t < T.apart) {
      leaving.draw(context, now, d());
      leaving.drawLabel(context, now, d());
    } else if (t < T.fly) {
      // It becomes its letters, and holds there a beat: a Cell made of characters.
      if (letters.length === 0) letters = apart(now);
      const u = Math.min(1, (t - T.apart) / (T.made - T.apart));
      if (u < 1) {
        leaving.alpha = 1 - u;
        leaving.draw(context, now, d());
      }
      context.globalAlpha = u;
      for (const l of letters) drawGlyph(context, l);
      context.globalAlpha = 1;
    } else if (!flown) {
      flown = true;
      const order = letters.toSorted((a, b) => a.y - b.y || a.x - b.x);
      order.forEach((l, n) =>
        stage.fliers.push({
          ch: l.ch,
          colour: l.colour,
          from: [l.x, l.y],
          to: stage.anySkin(),
          start: now + n * 0.012,
          duration: 1.0 + Math.random() * 0.35,
          lift: -CH * (3 + Math.random() * 4),
        }),
      );
    }
    stage.drawLetters(now);
    if (flown && stage.fliers.length === 0 && pleasedAt < 0) pleasedAt = now;
    if (pleasedAt > 0 && budAt < 0 && now - pleasedAt > 1.6) budAt = now;

    // Aski buds the next Cell, and the bud becomes it.
    let grid: Grid = stage.home;
    let eyes: EyeLook = {
      open: blinkFrom(now, nextBlink),
      fit: stage.fit,
      glyphs: pleasedAt > 0 && budAt < 0 ? MOODS.pleased : undefined,
    };
    if (budAt > 0) {
      const u = now - budAt;
      if (u < card.end) {
        grid = card.frame(u, stage.view.stage);
        eyes = eyesOf(card, u, stage.view.stage)!;
      } else if (born === null && bud !== undefined) {
        born = new Actor(next, bud.x / d(), bud.bottom / d());
        born.scale = SIZE;
        born.throwTo(bud.x / d(), stage.ground / d(), 0.32, now);
        born.say("Flying", "flying");
        born.play("busy/0", now + 0.5);
      }
    } else if (t > T.apart - 0.6 && !flown) {
      // Watching it go.
      const { fit } = stage;
      const [left, right] = EYES.centers.map(
        ([x, y]) => [(x + 6) * fit.kx + fit.cx, (y + 2) * fit.ky + fit.ground] as const,
      );
      eyes = { ...eyes, at: { at: [left!, right!], rows: EYES.height * fit.ky } };
    }
    if (born !== null) {
      born.step(dt, now, stage.ground / d(), d());
      born.draw(context, now, d());
      born.drawLabel(context, now, d());
      if (t > T.end - 1) born.alpha = Math.max(0, T.end - t);
    }
    if (now > nextBlink + BLINK.close + BLINK.open) nextBlink = now + 2.5 + Math.random() * 3;
    stage.paint(grid, eyes, now);
    if (t > T.end) reset(now);
  };

  stage.onResize = () => reset(began);
  reset(0);
  if (reduced) {
    drawCell(stage.context, giver, leaving!.frame(0), {
      x: leaving!.x * d(),
      y: leaving!.y * d(),
      px: Math.round(2 * d()),
    });
    stage.paint(stage.home, { open: 1, fit: stage.fit }, 0);
    return;
  }
  playWhileSeen(root, frame);
}

function drawGlyph(context: CanvasRenderingContext2D, l: Letter): void {
  context.drawImage(glyphOf(l.ch, l.colour), Math.round(l.x - CW / 2), Math.round(l.y - CH / 2));
}
