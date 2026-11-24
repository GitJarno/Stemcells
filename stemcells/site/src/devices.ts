// 04 · Every machine: the machines a person owns, each showing the app as it
// looks there. Cells thrown from the one in your hand fly on the far ones; when
// one asks, every screen says so at once, and the answer comes from another.
// The one in your hand is the kind the visitor is holding.

import { TONES } from "./actors.ts";
import { type Cell, crew, drawCell, frameAt } from "./cells.ts";
import { Exhibit } from "./kit/exhibit.ts";
import { feetAt, type Flight, flightOver, trailOf, type TrailDot } from "./kit/flight.ts";
import { density, ease, type Form, lerp, span } from "./kit/form.ts";
import { Glyphs, INK } from "./kit/glyphs.ts";
import { layerIn, scene, type SceneFrame } from "./kit/scenes.ts";
import type { ShotName } from "./shots.ts";

type Kind = "book" | "pad" | "phone";
/** A machine with a screen: its name, its screen's shape, and the app's screens it shows, calm then asked. */
const MACHINES: Readonly<
  Record<Kind, { name: string; ratio: number; shots: readonly ShotName[] }>
> = {
  book: { name: "MacBook", ratio: 1440 / 900, shots: ["arc-flying", "arc-input", "arc-flying"] },
  pad: {
    name: "iPad",
    ratio: 834 / 1194,
    shots: ["arc-flying-tablet", "arc-input-tablet", "arc-flying-tablet"],
  },
  phone: {
    name: "iPhone",
    ratio: 393 / 852,
    shots: ["arc-flying-phone", "arc-input-phone", "arc-flying-phone"],
  },
};
/** The machine in your hand, and the one the answer comes from. */
const NEAR: Readonly<Record<Form, Kind>> = { desk: "book", tablet: "pad", phone: "phone" };
const ANSWERS: Readonly<Record<Kind, Kind>> = { book: "phone", pad: "phone", phone: "book" };

/** Each screen's middle, the floor and its width, in shares of the art's box; the far Macs' shelf. */
const ROOMS: Readonly<
  Record<
    Form,
    {
      at: Record<Kind, readonly [cx: number, w: number]>;
      floor: number;
      shelf: readonly [y: number, from: number, to: number];
    }
  >
> = {
  desk: {
    at: { phone: [0.07, 0.125], book: [0.445, 0.6], pad: [0.89, 0.2] },
    floor: 0.95,
    shelf: [0.13, 0.58, 0.99],
  },
  tablet: {
    at: { book: [0.24, 0.44], pad: [0.685, 0.32], phone: [0.93, 0.13] },
    floor: 0.95,
    shelf: [0.14, 0.5, 0.98],
  },
  phone: {
    at: { book: [0.2, 0.36], phone: [0.57, 0.26], pad: [0.87, 0.2] },
    floor: 0.94,
    shelf: [0.22, 0.2, 0.8],
  },
};

const CREW = [
  ["Pickle", "gemini"],
  ["Otter", "claude"],
  ["Waffle", "codex"],
] as const;
const WORK = ["searching/0", "busy/0", "testing/0"] as const;
/** The story's beats along the scroll. */
const AT = {
  shown: 0.1,
  throws: [0.16, 0.27, 0.38],
  flight: 0.1,
  asks: 0.58,
  tap: 0.72,
  answered: 0.76,
} as const;
/** Which of the crew asks. */
const ASKER = 2;
const BEATS = [
  [0, "Six machines. One room."],
  [0.16, "Thrown from the one in front of you."],
  [0.48, "Flying on the Macs in the closet."],
  [0.58, "One asks. Every screen says so."],
  [0.76, "Answered from whichever is closest."],
] as const;
const STILL = 0.66;
const FONT =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

interface Machine {
  readonly kind: Kind;
  readonly box: HTMLElement;
  readonly app: Exhibit;
}

interface Plan {
  readonly flights: readonly Flight[];
  readonly trails: readonly (readonly TrailDot[])[];
  /** Where the tap lands: the answering machine's screen. */
  readonly tap: readonly [number, number];
  readonly scale: number;
}

export function devices(root: HTMLElement): void {
  const pin = root.querySelector<HTMLElement>(".pin")!;
  const art = root.querySelector<HTMLElement>(".art")!;
  const beat = root.querySelector<HTMLElement>(".beat")!;
  const glyphs = new Glyphs(layerIn(root, "glyphs over"));
  const cells = layerIn(root, "cells over");
  const context = cells.getContext("2d")!;
  const cast: Cell[] = crew(CREW);

  const room = document.createElement("div");
  room.className = "room";
  art.append(room);
  const machines: Machine[] = (["book", "pad", "phone"] as const).map((kind) => {
    const box = document.createElement("figure");
    box.className = `machine ${kind}`;
    const body = document.createElement("div");
    body.className = "body";
    const caption = document.createElement("figcaption");
    caption.innerHTML = `${MACHINES[kind].name}<b></b>`;
    box.append(body, caption);
    room.append(box);
    const app = new Exhibit(body, MACHINES[kind].shots);
    app.frame.style.aspectRatio = `${MACHINES[kind].ratio}`;
    return { kind, box, app };
  });
  const minis = CREW.map(() => {
    const mini = document.createElement("i");
    mini.className = "mini";
    room.append(mini);
    return mini;
  });
  const shelf = document.createElement("i");
  shelf.className = "shelf";
  room.append(shelf);
  const closet = document.createElement("span");
  closet.className = "closet";
  closet.textContent = "three Mac minis";
  room.append(closet);

  let plan: Plan | null = null;
  let saying = "";

  const layout = (f: SceneFrame): Plan => {
    const { width: aw, height: ah } = f.art;
    const where = ROOMS[f.form];
    const near = NEAR[f.form];
    room.dataset.form = f.form;
    for (const { kind, box, app } of machines) {
      const [cx, w] = where.at[kind];
      const wide = Math.round(aw * w);
      box.style.width = `${wide}px`;
      box.style.left = `${Math.round(aw * cx - wide / 2)}px`;
      box.style.bottom = `${Math.round(ah * (1 - where.floor))}px`;
      box.classList.toggle("near", kind === near);
      box.querySelector("b")!.textContent =
        kind !== near ? "" : kind === "book" ? " · on your desk" : " · in your hand";
      app.look(null);
    }
    const [sy, from, to] = where.shelf;
    const miniW = f.form === "phone" ? 44 : 72;
    minis.forEach((mini, n) => {
      const cx = lerp(from, to, (n + 0.5) / minis.length) * aw;
      mini.style.width = `${miniW}px`;
      mini.style.left = `${Math.round(cx - miniW / 2)}px`;
      mini.style.top = `${Math.round(ah * sy)}px`;
    });
    shelf.style.left = `${Math.round(aw * from)}px`;
    shelf.style.width = `${Math.round(aw * (to - from))}px`;
    shelf.style.top = `${Math.round(ah * sy) + (f.form === "phone" ? 15 : 21)}px`;
    closet.style.left = `${Math.round(aw * from)}px`;
    closet.style.width = `${Math.round(aw * (to - from))}px`;
    closet.style.top = `${Math.round(ah * sy) + (f.form === "phone" ? 22 : 30)}px`;

    // The throws: from the top of the screen in your hand to the top of each far Mac.
    const here = machines.find((machine) => machine.kind === near)!;
    const pinBox = pin.getBoundingClientRect();
    const screen = here.app.frame.getBoundingClientRect();
    const x0 = screen.left + screen.width / 2 - pinBox.left,
      y0 = screen.top - pinBox.top;
    const flights = minis.map((mini, n) => {
      const top = mini.getBoundingClientRect();
      const x1 = top.left + top.width / 2 - pinBox.left,
        y1 = top.top - pinBox.top;
      // The highest still clears the bar over the page by a Cell's own height.
      const apex = Math.max(f.art.y + 48, Math.min(y0, y1) - 60 - n * 22);
      return flightOver(x0, y0, x1, y1, apex);
    });
    const answering = machines.find((machine) => machine.kind === ANSWERS[near])!;
    const tapped = answering.app.frame.getBoundingClientRect();
    return {
      flights,
      trails: flights.map((flight) => trailOf(flight, f.form === "phone" ? 10 : 12)),
      tap: [
        tapped.left + tapped.width / 2 - pinBox.left,
        tapped.top + tapped.height * 0.62 - pinBox.top,
      ],
      scale: 2,
    };
  };

  scene(
    root,
    (f) => {
      const d = density();
      const { p } = f;
      glyphs.size(f.width, f.height);
      if (cells.width !== Math.round(f.width * d) || cells.height !== Math.round(f.height * d)) {
        cells.width = Math.round(f.width * d);
        cells.height = Math.round(f.height * d);
        cells.style.width = `${f.width}px`;
        cells.style.height = `${f.height}px`;
      }
      if (f.fresh || plan === null) plan = layout(f);
      const { flights, trails, scale } = plan;

      // The machines come in from the far ones to the one in your hand.
      const near = NEAR[f.form];
      machines.forEach(({ kind, box }, n) => {
        const late = kind === near ? 0.05 : n * 0.015;
        const there = ease.out(span(p, late, late + AT.shown * 0.6));
        box.style.opacity = `${there}`;
        box.style.transform = `translateY(${(1 - there) * 18}px)`;
      });
      const stocked = ease.out(span(p, 0, AT.shown * 0.5));
      for (const mini of minis) mini.style.opacity = `${stocked}`;
      shelf.style.opacity = `${stocked}`;
      closet.style.opacity = `${stocked}`;

      // Every screen says the same: calm, then asked, then calm again once it is answered.
      const asked = ease.inOut(span(p, AT.asks, AT.asks + 0.04)),
        answered = ease.inOut(span(p, AT.answered, AT.answered + 0.04));
      for (const { app, box } of machines) {
        app.turn(asked + answered);
        // Amber means Input: every machine's outline wears it while the question stands.
        box.style.setProperty("--asked", `${asked * (1 - answered)}`);
      }

      glyphs.clear();
      context.clearRect(0, 0, cells.width, cells.height);
      flights.forEach((flight, n) => {
        const thrown = AT.throws[n]!;
        if (p < thrown) return;
        const s = flight.time * span(p, thrown, thrown + AT.flight);
        const flying = s < flight.time;
        for (const dot of trails[n]!) {
          if (dot.s > s) break;
          const age = s - dot.s;
          glyphs.put("·", dot.x, dot.y, 20, INK, lerp(0.28, 0.8, Math.exp(-age / 0.25)));
        }
        const [x, y] = feetAt(flight, Math.min(s, flight.time));
        const cell = cast[n]!;
        const asking = n === ASKER && p >= AT.asks && p < AT.answered;
        const frame = frameAt(cell, flying ? "idle" : asking ? "waiting" : WORK[n]!, f.t + n * 0.6);
        drawCell(context, cell, frame, { x: x * d, y: y * d, px: scale * d });
        if (asking) {
          const up = ease.out(span(p, AT.asks, AT.asks + 0.03));
          context.font = `700 ${15 * d}px ${FONT}`;
          context.textAlign = "center";
          context.fillStyle = TONES.needsYou;
          context.globalAlpha = up;
          context.fillText("?", x * d, (y - 16 * scale - 8 - up * 4) * d);
          context.globalAlpha = 1;
        }
      });

      // The answer: a tap on another machine's screen.
      const tap = span(p, AT.tap, AT.answered);
      if (tap > 0 && tap < 1) {
        const [tx, ty] = plan.tap;
        context.strokeStyle = TONES.needsYou;
        context.lineWidth = 1.5 * d;
        context.globalAlpha = 1 - tap;
        context.beginPath();
        context.arc(tx * d, ty * d, (6 + tap * 20) * d, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 1;
      }
      glyphs.flush();

      const line = BEATS.findLast(([at]) => p >= at)![1];
      if (line !== saying) {
        saying = line;
        beat.textContent = line;
      }
    },
    { still: STILL },
  );
}
