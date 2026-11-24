// The hero's Cells. What the composer sends is thrown: its letters pour into
// Aski, Aski lets go, a Cell flies and lands. A Cell can be picked up and
// thrown again, as in the app. When the ground is full the oldest is settled:
// it comes apart into its letters and they go home into Aski.

import { CELL_PALETTE } from "./app.ts";
import { Actor, type Span } from "./actors.ts";
import { type Cell, crew, rasterOf } from "./cells.ts";
import type { Hero } from "./hero.ts";
import { CH, CW } from "./stagekit.ts";
import { reduced } from "./theater.ts";

/** What the page throws while nobody types: things people hand their Cells. */
const ASKS = ["fix the flaky test", "add dark mode", "write the docs", "speed up search"];
/** The crew, from the app's own names, each in a body's colours. */
const CREW = (
  [
    ["Otter", "claude"],
    ["Waffle", "codex"],
    ["Pickle", "gemini"],
    ["Kiwi", "kimi"],
    ["Tofu", "frost"],
    ["Wombat", "claude"],
    ["Turnip", "codex"],
    ["Beans", "gemini"],
  ] as const
).filter(([, body]) => body in CELL_PALETTE.bodies);

interface Thrown {
  readonly actor: Actor;
  readonly words: string;
  /** Where it means to stand, CSS pixels along the ground. */
  slot: number;
  /** When it is thrown, or -1 once it has been. */
  due: number;
  /** When it began to be settled, or -1. */
  leaving: number;
}

export function throws(hero: Hero): void {
  const { stage, box, input } = hero;
  const cells: Cell[] = crew(CREW);
  const thrown: Thrown[] = [];
  let dealt = 0;
  let landed = 0;
  let held: { it: Thrown; trail: [number, number, number][] } | null = null;
  /** When the page next throws on its own, and what it is typing meanwhile. */
  let next = 0.9;
  let typing: { text: string; from: number } | null = null;
  /** What the page last typed into the composer: anything else there is the visitor's. */
  let ours = "";
  let touched = -100;

  const { narrow } = hero;
  const width = () => stage.width / stage.d;
  const room = () => (narrow() ? 2 : width() < 760 ? 3 : 4);
  /** Where the nth Cell stands: right of Aski on a wide stage, either side of it on a narrow one. */
  const slotAt = (n: number): number => {
    if (narrow()) return width() * (n % 2 === 0 ? 0.88 : 0.12);
    // Clear of Aski's side, to the stage's edge.
    const from = ((stage.fit.cx + 140 * stage.fit.kx) * CW) / stage.d + 56,
      to = width() - 56;
    return from + ((to - from) * (n % room())) / Math.max(1, room() - 1);
  };
  const scale = () => (narrow() ? 2 : 3);

  const send = (text: string) => {
    const cell = cells[dealt % cells.length]!;
    const [x, y] = hero.launch();
    const actor = new Actor(cell, x, y);
    actor.alpha = 0;
    actor.scale = scale();
    const colour = CELL_PALETTE.bodies[cell.body as keyof typeof CELL_PALETTE.bodies].B;
    const poured = hero.pour(text, colour);
    hero.throwAt(poured + 0.12);
    thrown.push({ actor, words: text, slot: slotAt(dealt), due: poured + 0.12, leaving: -1 });
    dealt += 1;
  };
  /** Under Reduce Motion a sent thought has simply landed. */
  const land = (text: string) => {
    const standing = thrown.filter((it) => it.leaving < 0);
    if (standing.length >= room()) thrown.splice(thrown.indexOf(standing[0]!), 1);
    const actor = new Actor(cells[dealt % cells.length]!, slotAt(dealt), hero.floor());
    actor.scale = scale();
    actor.say("Landed", "landed");
    thrown.push({ actor, words: text, slot: slotAt(dealt), due: -1, leaving: -1 });
    dealt += 1;
    hero.redraw();
  };
  hero.onSend = (text) => {
    touched = hero.now();
    typing = null;
    ours = "";
    if (reduced) land(text);
    else send(text);
  };
  // The visitor's own typing ends the page's: what it had typed goes, what they type stays.
  input.addEventListener("focus", () => {
    if (typing !== null || (ours !== "" && input.value === ours)) input.value = "";
    typing = null;
    ours = "";
    touched = hero.now();
  });
  input.addEventListener("input", () => {
    typing = null;
    ours = "";
    touched = hero.now();
  });

  /** The Cell's picture as letters, one wherever its art covers a grid cell, in the art's colour there. */
  const apart = (it: Thrown, now: number) => {
    const { actor } = it;
    const d = stage.d;
    const raster = rasterOf(actor.frame(now), actor.cell.body);
    const px = Math.max(1, Math.round(actor.scale * d));
    const w = raster.width * px,
      h = raster.height * px;
    const left = actor.x * d - w / 2,
      top = actor.y * d - h + 2 * px;
    const data = raster.getContext("2d")!.getImageData(0, 0, raster.width, raster.height).data;
    const words = it.words.replace(/[^a-z]/gi, "").toLowerCase() || "cell";
    let n = 0;
    for (let j = Math.floor(top / CH); j * CH < top + h; j++)
      for (let i = Math.floor(left / CW); i * CW < left + w; i++) {
        const ax = Math.floor(((i + 0.5) * CW - left) / px),
          ay = Math.floor(((j + 0.5) * CH - top) / px);
        if (ax < 0 || ay < 0 || ax >= raster.width || ay >= raster.height) continue;
        const o = (ay * raster.width + ax) * 4;
        if (data[o + 3]! < 128) continue;
        const hex = (v: number) => v.toString(16).padStart(2, "0");
        stage.fliers.push({
          ch: words[n % words.length]!,
          colour: `#${hex(data[o]!)}${hex(data[o + 1]!)}${hex(data[o + 2]!)}`,
          from: [(i + 0.5) * CW, (j + 0.5) * CH],
          to: stage.anySkin(),
          start: now + n * 0.014,
          duration: 0.95 + ((n * 53) % 10) * 0.03,
          lift: -CH * (3 + (n % 5)),
        });
        n++;
      }
  };

  // Picking a Cell up, and letting it go with speed.
  const at = (event: PointerEvent | Touch): [number, number] => {
    const rect = stage.back.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const under = (x: number, y: number): Thrown | undefined =>
    thrown.findLast(({ actor, due, leaving }) => {
      const half = 13 * actor.scale,
        tall = 28 * actor.scale;
      return (
        due < 0 &&
        leaving < 0 &&
        Math.abs(x - actor.x) < half &&
        y < actor.y + 8 &&
        y > actor.y - tall
      );
    });
  box.addEventListener("pointerdown", (event) => {
    const [x, y] = at(event);
    const it = under(x, y);
    if (it === undefined) return;
    event.preventDefault();
    box.setPointerCapture(event.pointerId);
    box.classList.add("holding");
    touched = hero.now();
    it.actor.held = true;
    it.actor.flying = false;
    it.actor.vx = 0;
    it.actor.vy = 0;
    it.actor.say("Flying", "flying");
    held = { it, trail: [[x, y, performance.now()]] };
  });
  box.addEventListener("pointermove", (event) => {
    if (held === null) return;
    const [x, y] = at(event);
    held.it.actor.x = x;
    held.it.actor.y = y + 16 * held.it.actor.scale;
    held.trail.push([x, y, performance.now()]);
    if (held.trail.length > 8) held.trail.shift();
  });
  const letGo = () => {
    if (held === null) return;
    const { it, trail } = held;
    held = null;
    box.classList.remove("holding");
    const first = trail[0]!,
      last = trail.at(-1)!;
    const dt = Math.max(0.016, (last[2] - first[2]) / 1000);
    const clampTo = (v: number) => Math.max(-2200, Math.min(2200, v));
    it.actor.held = false;
    it.actor.vx = clampTo((last[0] - first[0]) / dt);
    it.actor.vy = clampTo((last[1] - first[1]) / dt);
    it.actor.flying = true;
    it.actor.hits = [];
    it.actor.target = null;
    it.actor.on = null;
  };
  box.addEventListener("pointerup", letGo);
  box.addEventListener("pointercancel", letGo);
  // A finger that starts on a Cell carries it; anywhere else it scrolls the page.
  box.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (touch !== undefined && under(...at(touch)) !== undefined) event.preventDefault();
    },
    { passive: false },
  );

  const step = (now: number, dt: number) => {
    const floor = hero.floor();
    // The page throws on its own until someone takes over, and again once they rest.
    const free = document.activeElement !== input && held === null && input.value === ours;
    if (!reduced && now - touched > 14 && free) {
      if (typing === null && now > next) typing = { text: ASKS[dealt % ASKS.length]!, from: now };
      if (typing !== null) {
        const shown = Math.floor((now - typing.from) * 16);
        ours = typing.text.slice(0, shown);
        input.value = ours;
        if (shown > typing.text.length + 5) {
          ours = "";
          input.value = "";
          send(typing.text);
          typing = null;
          next = now + 5.2;
        }
      }
    }
    // The ground holds so many; the oldest is settled.
    const standing = thrown.filter((it) => it.leaving < 0);
    if (standing.length > room()) {
      const oldest = standing[0]!;
      oldest.leaving = now;
      oldest.actor.say("Settled", "settled");
    }
    for (let n = thrown.length - 1; n >= 0; n--) {
      const it = thrown[n]!;
      const { actor } = it;
      if (it.due >= 0 && now >= it.due) {
        it.due = -1;
        const [x, y] = hero.launch();
        actor.x = x;
        actor.y = y;
        actor.alpha = 1;
        actor.say("Flying", "flying");
        actor.throwTo(it.slot, floor, 0.95, now);
      }
      if (it.due >= 0 || actor.held) continue;
      const was = actor.flying;
      const speed = Math.hypot(actor.vx, actor.vy);
      actor.step(dt, now, floor, stage.d);
      // The stage's sides and top send a thrown Cell back.
      const half = 13 * actor.scale * 0.5 + 4;
      if (actor.flying) {
        if (actor.x < half || actor.x > width() - half) {
          actor.hits.push({
            surface: actor.x < half ? "left" : "right",
            speed: Math.abs(actor.vx),
            at: now * 1000,
          });
          actor.x = actor.x < half ? half : width() - half;
          if (Math.abs(actor.vx) > 500) actor.bonkAt = now;
          actor.vx = -actor.vx * 0.45;
        }
        if (actor.y < 30 * actor.scale && actor.vy < 0) {
          actor.hits.push({ surface: "ceiling", speed: -actor.vy, at: now * 1000 });
          actor.vy = -actor.vy * 0.3;
        }
      }
      if (was && !actor.flying) {
        landed += 1;
        actor.say("Landed", "landed");
        if (speed > 1500) actor.dizzyUntil = now + 1.6;
        else actor.play("happy", now + 0.7);
        if (landed === 1) hero.swapTitle();
      }
      if (actor.key === "happy" && now - actor.since > 1.8) actor.play("idle", now);
      if (it.leaving >= 0 && now - it.leaving > 0.9) {
        apart(it, now);
        thrown.splice(n, 1);
      }
    }
  };

  hero.watch = () => {
    const it = held?.it ?? thrown.find(({ actor, due }) => due < 0 && actor.flying);
    return it === undefined ? null : [it.actor.x, it.actor.y - 14 * it.actor.scale];
  };
  hero.onFrame = (now, dt) => {
    step(now, dt);
    const context = stage.context;
    for (const { actor, due } of thrown) if (due < 0) actor.draw(context, now, stage.d);
    // A name never lies over Aski or another name: the latest to land keeps its whole label.
    const half = 140 * stage.fit.kx;
    const taken: Span[] = [[(stage.fit.cx - half) * CW, (stage.fit.cx + half) * CW]];
    for (const { actor, due } of thrown.toReversed()) {
      if (due >= 0) continue;
      const resting = !actor.flying && !actor.held;
      const span = actor.drawLabel(context, now, stage.d, resting ? taken : []);
      if (resting && span !== null) taken.push(span);
    }
  };

  stage.onResize = ((before) => () => {
    before();
    thrown.forEach((it, n) => {
      it.actor.scale = scale();
      it.slot = slotAt(n);
      if (!it.actor.flying && !it.actor.held) {
        it.actor.x = Math.min(width() - 20, it.actor.x);
        it.actor.y = hero.floor();
      }
    });
  })(stage.onResize);

  if (reduced) {
    // The still: two have landed.
    ASKS.slice(0, 2).forEach((words, n) => {
      const actor = new Actor(cells[n]!, slotAt(n), hero.floor());
      actor.scale = scale();
      actor.say("Landed", "landed");
      thrown.push({ actor, words, slot: slotAt(n), due: -1, leaving: -1 });
    });
    dealt = 2;
    requestAnimationFrame(() => hero.redraw());
  }
}
