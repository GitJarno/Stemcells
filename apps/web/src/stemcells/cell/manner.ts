// A Cell's manner: the temperament it is dealt for life from its name (`art/temperaments/`), and
// with it a breath, a blink, where it looks at rest, a fidget and its own take on the moments.
// Its rest is a scene made here from that record; the moments are drawn (`art/moves/manner.json`).
// Pure, and the phone's too. The design: `stemcells/tasks/cell-life.md`, Temperament.

import { fnv1a32 } from "./blink.ts";
import { type Frame, REST, RIG, type Scene, type Temperament, TEMPERAMENTS } from "./kit.ts";
import { score } from "./looks.ts";

/** How a Cell with no temperament carries itself: the original's breath and blink, every Cell's beats. */
const ORIGINAL: Temperament = {
  id: "original",
  weight: 1,
  breath: { periodMs: 4000, depthRows: 1 },
  blink: { windowMs: 4000, shutMs: 150, double: false },
  noticeMs: 0,
  gaze: [],
  beats: {},
};

const dealt = new Map<string, Temperament>();

/**
 * The temperament the Cell `name` names carries for life: a weighted rendezvous over the
 * temperaments, on a salt of its own, so a Cell's manner and its look vary apart. A Cell with
 * no name, or a kit with no temperaments, carries itself as the original did.
 */
export function mannerOf(name: string): Temperament {
  if (name === "" || TEMPERAMENTS.size === 0) return ORIGINAL;
  const known = dealt.get(name);
  if (known !== undefined) return known;
  let best: { manner: Temperament; key: number } | undefined;
  for (const manner of [...TEMPERAMENTS.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    // Uniform in (0, 1]; the smallest −ln(u) / weight wins, so a weight of 2 is dealt twice as often.
    const u = (Number(score(`temperament:${name}|${manner.id}`) >> 11n) + 1) / 2 ** 53;
    const key = -Math.log(u) / manner.weight;
    if (best === undefined || key < best.key) best = { manner, key };
  }
  const manner = best?.manner ?? ORIGINAL;
  dealt.set(name, manner);
  return manner;
}

const mannerById = (id: string): Temperament | undefined =>
  id === ORIGINAL.id ? ORIGINAL : TEMPERAMENTS.get(id);

/** Frames a second a rest is drawn at: a breath changes a row, a glance a cell, and neither hurries. */
const REST_FPS = 3;

/** The frames of a breath, each its height scale and whether it swells. */
function breathOf(manner: Temperament): { sy: number; sx?: number }[] {
  const { periodMs, depthRows, outShare, puff } = manner.breath;
  const count = Math.max(3, Math.round((periodMs * REST_FPS) / 1000));
  const out = Math.min(count - 2, Math.max(1, Math.round(count * (outShare ?? 1 / 3))));
  const first = Math.floor((count - out) / 2);
  const low = 1 - depthRows / RIG.restRows;
  // Swollen it is taller and no narrower: bigger, where a stretch would only be thinner.
  const high = { sy: 1 + 1 / RIG.restRows, sx: 1 };
  const swell = puff ? Math.min(2, first) : 0;
  return Array.from({ length: count }, (_, i) =>
    i >= first && i < first + out
      ? { sy: low }
      : i >= first - swell && i < first
        ? high
        : { sy: 1 },
  );
}

/**
 * A manner's rest as a loop: its breath, and its glances over it. The glances' cycle is
 * rounded out to whole breaths, looking ahead for the rest, so the loop closes. With `eyes`
 * other than calm (a landing's `^ ^`) it only breathes.
 */
function restFrames(
  manner: Temperament,
  eyes: string,
  watching?: { readonly x: number; readonly y: number },
): Frame[] {
  const breath = breathOf(manner);
  // Watching the person's hand, it looks nowhere else.
  const glances =
    watching !== undefined
      ? [{ look: [watching.x, watching.y], holdMs: 1000 }]
      : eyes === "calm"
        ? manner.gaze
        : [];
  const looks = glances.flatMap(({ look, holdMs }) =>
    Array.from({ length: Math.max(1, Math.round((holdMs * REST_FPS) / 1000)) }, () => look),
  );
  const count = Math.max(1, Math.ceil(looks.length / breath.length)) * breath.length;
  return Array.from({ length: count }, (_, i) => {
    const look = looks[i] ?? [0, 0];
    return {
      pose: {
        ...REST,
        ...breath[i % breath.length],
        eyes,
        look: { x: look[0] ?? 0, y: look[1] ?? 0 },
      },
      layers: [],
      swaps: {},
    };
  });
}

/** The scenes a manner's record makes: its rest (`rest/keen`), and its rest once landed (`pleased/keen`). */
const MADE: Readonly<Record<string, string>> = { rest: "calm", pleased: "happy" };

const generated = new Map<string, Scene | undefined>();

/** A step of a glance: left or up, ahead, right or down. */
const STEPS = [-1, 0, 1];

/**
 * The scene `key` names when a manner's record makes it (`rest/<id>`, `pleased/<id>`, and a
 * rest watching the person's hand, `rest/<id>@1,-1`); undefined for any other.
 */
export function generatedScene(key: string): Scene | undefined {
  if (generated.has(key)) return generated.get(key);
  const [kind = "", rest = ""] = key.split("/");
  const [id = "", toward] = rest.split("@");
  const eyes = MADE[kind];
  const manner = mannerById(id);
  const [x, y] = (toward ?? "").split(",").map(Number);
  const watching =
    toward !== undefined && kind === "rest" && STEPS.includes(x!) && STEPS.includes(y!)
      ? { x: x!, y: y! }
      : undefined;
  const named =
    manner === undefined
      ? undefined
      : watching === undefined
        ? `${kind}/${id}`
        : watchingKey(manner, watching);
  const scene: Scene | undefined =
    eyes === undefined || manner === undefined || key !== named
      ? undefined
      : {
          fps: REST_FPS,
          facing: "right",
          frames: restFrames(manner, eyes, watching),
          meta: { kind: "loop", tell: 0 },
          holds: false,
          pieces: "loop",
        };
  generated.set(key, scene);
  return scene;
}

/** The scene a Cell of `manner` rests in, and the one it rests in once landed, `^ ^`. */
export const restKey = (manner: Temperament): string => `rest/${manner.id}`;
export const pleasedKey = (manner: Temperament): string => `pleased/${manner.id}`;
/** The rest of a Cell of `manner` that watches the person's hand, a step each way from it. */
export const watchingKey = (
  manner: Temperament,
  toward: { readonly x: number; readonly y: number },
): string => `rest/${manner.id}@${Math.sign(toward.x)},${Math.sign(toward.y)}`;

const phases = new Map<string, number>();

/** How far along its loops the Cell `name` names stands, in seconds: its own, so a crew at rest never moves as one. */
export function phaseOf(name: string): number {
  let phase = phases.get(name);
  if (phase === undefined) {
    phase = (fnv1a32(`${name}#phase`) % 6000) / 100;
    phases.set(name, phase);
  }
  return phase;
}

/** A Cell may fidget once in a window this long, in seconds. */
export const FIDGET_WINDOW = 90;
/** One window in this many holds a fidget: about one every six minutes a Cell. */
const FIDGET_ONE_IN = 4;
/** A fidget starts this far into its window at the earliest, and ends before the window does. */
const FIDGET_EARLIEST = 4;
const FIDGET_SPAN = 72;

/**
 * How long ago the Cell `name` names began the fidget of the window `seconds` falls in (on
 * `clockSeconds`); undefined in a window that holds none, and before it begins. Each Cell's
 * moments are its own, so a crew fidgets one at a time, nearly always.
 */
export function fidgetingFor(name: string, seconds: number): number | undefined {
  const window = Math.floor(seconds / FIDGET_WINDOW);
  let fidget = fidgets.get(name);
  if (fidget?.window !== window) {
    const hash = fnv1a32(`${name}#fidget#${window}`);
    const starts = window * FIDGET_WINDOW + FIDGET_EARLIEST + ((hash >>> 8) % FIDGET_SPAN);
    fidget = { window, start: hash % FIDGET_ONE_IN === 0 ? starts : undefined };
    fidgets.set(name, fidget);
  }
  return fidget.start !== undefined && seconds >= fidget.start ? seconds - fidget.start : undefined;
}

/** The window each Cell was last asked about, and when its fidget starts: asked every beat, a window lasts a minute and a half. */
const fidgets = new Map<string, { window: number; start: number | undefined }>();
