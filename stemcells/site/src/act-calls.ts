// 03 · You still make the calls. Aski throws three Cells at three problems. Two
// stick their landing; one falls short, bonks the side of its problem and asks
// you. Answer, and it lands too.

import { BLINK, blinkFrom, BODY_HEIGHT, CELL_ASPECT, EYES, type Fit, MOODS } from "./app.ts";
import {
  Actor,
  type Ledge,
  ledgeHeight,
  ledgeWidth,
  TONES,
  WORD_SCALE,
  writeWord,
} from "./actors.ts";
import { crew } from "./cells.ts";
import { CW, Stage } from "./stagekit.ts";
import { playWhileSeen, reduced } from "./theater.ts";

/** Aski small, at the left, on the ground. */
const fitLeft = (stage: { cols: number; rows: number }): Fit => {
  const ky = (stage.rows * 0.4) / BODY_HEIGHT;
  return { cx: stage.cols * 0.17, ground: stage.rows * 0.84, kx: ky / CELL_ASPECT, ky };
};

const PROBLEMS = ["tests", "docs", "deploy"] as const;
const QUESTION = { ask: "deploy wants a key.", next: "Use staging's?", yes: "Use it" };
/** Seconds: each throw, and the loop's end. */
const THROWS = [0.8, 2.6, 4.4];
const LOOP = 19;

export function calls(root: HTMLElement): void {
  const stage = new Stage(root, fitLeft);
  const cells = crew([
    ["Pip", "claude"],
    ["Moose", "codex"],
    ["Mango", "gemini"],
  ]);
  const ask = document.createElement("div");
  ask.className = "ask";
  ask.innerHTML = `<p><span class="bel" title="BEL">^G</span> <b>Mango</b> ${QUESTION.ask}<br />${QUESTION.next}</p><button type="button">${QUESTION.yes}</button>`;
  root.append(ask);

  let actors: Actor[] = [];
  let ledges: Ledge[] = [];
  let began = 0;
  let asking = -1;
  let answered = -1;
  let nextBlink = 2;

  const d = () => stage.d;
  const floor = () => stage.ground / d();
  const launch = (): [number, number] => {
    const [x, y] = stage.point(70, -150);
    return [x / d(), y / d()];
  };

  const layout = () => {
    const width = stage.width / d();
    const f = floor();
    ledges = PROBLEMS.map((word, n) => ({
      word,
      x: width * [0.52, 0.68, 0.86][n]! - (word.length * CW * WORD_SCALE) / d() / 2,
      top: f - (stage.height / d()) * [0.26, 0.37, 0.31][n]!,
    }));
  };

  const reset = (now: number) => {
    layout();
    const [x, y] = launch();
    actors = cells.map((cell, n) => {
      const actor = new Actor(cell, x, y);
      actor.alpha = 0;
      actor.target = ledges[n]!;
      if (root.clientWidth < 560) actor.scale = 1.5;
      return actor;
    });
    began = now;
    asking = -1;
    answered = -1;
    ask.classList.remove("on");
  };

  const answer = (now: number) => {
    if (asking < 0 || answered > 0) return;
    answered = now;
    ask.classList.remove("on");
    const mango = actors[2]!;
    const ledge = ledges[2]!;
    mango.say("Flying", "flying");
    mango.throwTo(ledge.x + ledgeWidth(ledge, d()) / 2, ledge.top, 0.8, now, true);
  };
  let clock = 0;
  ask.querySelector("button")!.addEventListener("click", () => answer(clock));

  const step = (now: number, dt: number) => {
    const t = now - began;
    actors.forEach((actor, n) => {
      const ledge = ledges[n]!;
      if (actor.alpha === 0 && t >= THROWS[n]!) {
        actor.alpha = 1;
        actor.say("Flying", "flying");
        if (n === 2) {
          // Short: it meets its problem's side, halfway up the word.
          actor.throwTo(ledge.x - 22, ledge.top + ledgeHeight(d()) / 2 + 6, 0.78, now);
        } else actor.throwTo(ledge.x + ledgeWidth(ledge, d()) / 2, ledge.top, 0.95, now);
      }
      const wasFlying = actor.flying;
      actor.step(dt, now, floor(), d());
      if (wasFlying && !actor.flying) {
        if (actor.on !== null) {
          actor.say("Landed", "landed");
          actor.play("happy", now + 0.7);
        } else {
          // Fell short: dazed, then it asks.
          actor.dizzyUntil = now + 1.6;
          actor.say("Flying", "flying");
          asking = now + 1.6;
        }
      }
      if (actor.key === "happy" && now - actor.since > 1.6) actor.play("idle", now);
    });
    const mango = actors[2]!;
    if (asking > 0 && answered < 0 && now >= asking && mango.tone !== "needsYou") {
      mango.say("Input", "needsYou");
      mango.play("waiting", now);
      // Aski brings you the question, from over its head; on a narrow stage, from its top corner.
      const narrow = root.clientWidth < 560;
      const y = narrow ? 8 : stage.css(...stage.point(0, -236))[1];
      ask.classList.toggle("corner", narrow);
      ask.style.left = "10px";
      ask.style.top = `${y}px`;
      ask.classList.add("on");
    }
    if (asking > 0 && answered < 0 && now - asking > 6) answer(now);
    const landed = actors.every((a) => a.on !== null && !a.flying);
    if (landed && answered > 0 && now - answered > 3.2)
      for (const a of actors) if (a.tone === "landed") a.say("Settled", "settled");
    if (t > LOOP - 1) for (const a of actors) a.alpha = Math.max(0, LOOP - t);
    if (t > LOOP) reset(now);
  };

  const drawAski = (now: number) => {
    const t = now - began;
    // A wind-up before each throw, a stretch as it lets go.
    let squash = 0;
    for (const at of THROWS) {
      const u = t - at;
      if (u > -0.28 && u < 0) squash = -0.09 * Math.sin(((u + 0.28) / 0.28) * (Math.PI / 2));
      else if (u >= 0 && u < 0.35) squash = 0.06 * Math.sin((u / 0.35) * Math.PI);
    }
    const base = stage.fit;
    const fit: Fit =
      squash === 0
        ? base
        : { ...base, ky: base.ky * (1 + squash), kx: base.kx * (1 - squash * 0.7) };
    const grid = squash === 0 ? stage.home : stage.cloudAt(fit);
    // The eyes follow whoever flies, and look at you while one needs you.
    const flier =
      actors.find((a) => a.flying) ?? (asking > 0 && answered < 0 ? actors[2] : undefined);
    let look: [number, number] = [0, 0];
    if (flier !== undefined) {
      const [ex, ey] = stage.point(31, -151);
      const dx = flier.x * d() - ex,
        dy = flier.y * d() - 40 * d() - ey;
      const far = Math.hypot(dx, dy) || 1;
      look = [(dx / far) * 7, (dy / far) * 6];
    }
    const needs = asking > 0 && answered < 0 && now >= asking;
    if (now > nextBlink + BLINK.close + BLINK.open) nextBlink = now + 2.5 + Math.random() * 3;
    stage.paint(
      grid,
      {
        open: needs ? 1 : blinkFrom(now, nextBlink),
        fit,
        at: {
          at: [
            [
              (EYES.centers[0][0] + look[0]) * fit.kx + fit.cx,
              (EYES.centers[0][1] + look[1]) * fit.ky + fit.ground,
            ],
            [
              (EYES.centers[1][0] + look[0]) * fit.kx + fit.cx,
              (EYES.centers[1][1] + look[1]) * fit.ky + fit.ground,
            ],
          ],
          rows: EYES.height * fit.ky,
        },
        glyphs: needs ? MOODS.needsYou : undefined,
      },
      now,
    );
  };

  const draw = (now: number) => {
    stage.clear();
    const context = stage.context;
    for (const ledge of ledges) {
      const center = (ledge.x + ledgeWidth(ledge, d()) / 2) * d();
      writeWord(
        context,
        ledge.word,
        center,
        (ledge.top + ledgeHeight(d()) / 2) * d() + 2,
        TONES.landed,
        WORD_SCALE,
      );
    }
    for (const actor of actors) actor.draw(context, now, d());
    for (const actor of actors) actor.drawLabel(context, now, d());
    drawAski(now);
  };

  stage.onResize = () => reset(clock);
  reset(0);
  if (reduced) {
    for (let t = 0; t < 7.5; t += 1 / 60) {
      clock = t;
      step(t, 1 / 60);
    }
    draw(clock);
    return;
  }
  playWhileSeen(root, (now, dt) => {
    clock = now;
    step(now, dt);
    draw(now);
  });
}
