// 02 · Grow your agents. One Cell at work, alone, while a clock runs: the
// longer it goes without you, the stronger it grows, nubs to arms to biceps,
// as the app grows a Cell from its time alone (`growth.ts`). Then the flex.

import { grown, type Strength } from "./app-cells.ts";
import { Actor } from "./actors.ts";
import { crew } from "./cells.ts";
import { Stage } from "./stagekit.ts";
import { playWhileSeen, reduced } from "./theater.ts";

/** Each stretch alone: from when, how long it reads, how strong, what it does. */
const STEPS: readonly { at: number; alone: string; strength?: Strength; doing: string }[] = [
  { at: 0, alone: "4 min", doing: "busy/0" },
  { at: 3, alone: "40 min", strength: "nubs", doing: "building/0" },
  { at: 6, alone: "3 h", strength: "arms", doing: "testing/0" },
  { at: 9, alone: "9 h", strength: "biceps", doing: "happy" },
];
const LOOP = 14;

export function grow(root: HTMLElement): void {
  // No Aski here: the stage's grid stays empty and the Cell has it to itself.
  const stage = new Stage(root, (s) => ({ cx: -s.cols, ground: s.rows, kx: 0.01, ky: 0.01 }));
  const [cell] = crew([["Pip", "claude"]]);
  const meter = document.createElement("div");
  meter.className = "meter";
  root.append(meter);
  const bubble = document.createElement("div");
  bubble.className = "say small";
  bubble.textContent = "Look at those arms.";
  root.append(bubble);

  let began = 0;
  let step = -1;
  const actor = new Actor(cell!, 0, 0);
  actor.scale = 4;

  const place = () => {
    actor.x = stage.width / stage.d / 2;
    actor.y = (stage.height / stage.d) * 0.78;
  };

  const show = (n: number, now: number) => {
    const s = STEPS[n]!;
    step = n;
    actor.cell = { ...cell!, look: grown(cell!.look, s.strength, s.strength === "biceps") };
    actor.play(s.doing, now);
    // Each new strength lands with a little bounce.
    if (n > 0) {
      actor.hits = [{ surface: "floor", speed: 520, at: now * 1000 }];
      actor.landedAt = now;
    }
    const filled = Math.round(((n + 1) / STEPS.length) * 12);
    meter.innerHTML = `<span>alone</span> <b>${"█".repeat(filled)}</b><i>${"░".repeat(12 - filled)}</i> <span>${s.alone}</span>`;
    if (s.strength === "biceps") {
      const [x, y] = stage.css(actor.x * stage.d, (actor.y - 150) * stage.d);
      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
      bubble.classList.add("on");
    } else bubble.classList.remove("on");
  };

  const frame = (now: number) => {
    const t = now - began;
    const due = STEPS.findLastIndex((s) => t >= s.at);
    if (due !== step) show(due, now);
    stage.clear();
    actor.draw(stage.context, now, stage.d);
    if (t > LOOP) {
      began = now;
      step = -1;
    }
  };

  stage.onResize = place;
  place();
  if (reduced) {
    show(STEPS.length - 1, 0);
    actor.draw(stage.context, 10, stage.d);
    return;
  }
  playWhileSeen(root, frame);
}
