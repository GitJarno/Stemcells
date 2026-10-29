// 01 · One sentence in. A crew out. You tell Aski something; your words pour
// into it while its eyes follow them (`the-wait`), it buds a small cloud for
// each part of the job, spelled in its task word (`the-bud`), and each bud
// becomes a Cell that drops to the ground and gets to work.

import { BLINK, blinkFrom, SCENE_CARDS } from "./app.ts";
import { Actor } from "./actors.ts";
import { type Bud, budCard, budsOf } from "./buds.ts";
import { crew } from "./cells.ts";
import { CH, INK_HEX, Stage } from "./stagekit.ts";
import { type EyeLook, eyesOf, playWhileSeen, reduced } from "./theater.ts";

const DEMOS = [
  "a recipe app with a shopping list",
  "fix the login bug and add tests",
  "a blog with search and dark mode",
];
const SKIP = new Set([
  "the",
  "and",
  "with",
  "for",
  "app",
  "add",
  "fix",
  "make",
  "that",
  "this",
  "from",
  "into",
  "some",
  "please",
]);
/** Seconds: the words' pour, and how long the crew works before the next sentence. */
const POUR = 1.4,
  WORK = 6;

/** Up to three task words from what was said: its longest real words, in order. */
export function tasksOf(sentence: string): string[] {
  const words = sentence.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const kept = [...new Set(words.filter((w) => !SKIP.has(w)))];
  const longest = kept.toSorted((a, b) => b.length - a.length).slice(0, 3);
  const tasks = kept.filter((w) => longest.includes(w)).map((w) => w.slice(0, 9));
  return tasks.length > 0 ? tasks : ["build"];
}

export function birth(root: HTMLElement): void {
  const stage = new Stage(root);
  const form = root.querySelector("form")!;
  const input = form.querySelector("input")!;
  const team = crew([
    ["Pip", "claude"],
    ["Moose", "codex"],
    ["Mango", "gemini"],
  ]);
  const wait = SCENE_CARDS["the-wait"]!({ seed: 7, times: { lookIn: 0.6, turn: 1.6 } });

  type Phase = "idle" | "pour" | "bud" | "work";
  let phase: Phase = "idle";
  let since = 0;
  let clock = 0;
  let words: string[] = [];
  let buds: Bud[] = [];
  let card = budCard(["build"]);
  let actors: Actor[] = [];
  let touched = false;
  let demo = 0;
  let typing: { text: string; from: number } | null = null;
  let nextBlink = 2;

  const send = (sentence: string) => {
    if (phase !== "idle" || sentence.trim() === "") return;
    words = tasksOf(sentence);
    card = budCard(words);
    buds = budsOf(stage, card, words);
    // Each character of the sentence leaves the box and pours into Aski.
    const box = input.getBoundingClientRect(),
      rect = stage.back.getBoundingClientRect();
    const d = stage.d;
    const chars = [...sentence.replace(/\s+/g, " ")];
    const charWidth = Math.min(9.1, box.width / Math.max(1, chars.length));
    chars.forEach((ch, n) => {
      if (ch === " ") return;
      stage.fliers.push({
        ch,
        colour: INK_HEX,
        from: [
          (box.left - rect.left + 6 + n * charWidth) * d,
          (box.top - rect.top + box.height / 2) * d,
        ],
        to: stage.anySkin(),
        start: clock + n * 0.018,
        duration: 0.8 + Math.random() * 0.3,
        lift: CH * (1 + Math.random() * 2),
      });
    });
    input.value = "";
    input.blur();
    phase = "pour";
    since = clock;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    touched = true;
    typing = null;
    send(input.value);
  });
  input.addEventListener("focus", () => {
    touched = true;
    typing = null;
  });

  const frame = (now: number, dt: number) => {
    clock = now;
    const t = now - since;
    stage.clear();
    // The demo types itself in while no one has.
    if (phase === "idle" && !touched) {
      if (typing === null && t > 1.2) typing = { text: DEMOS[demo++ % DEMOS.length]!, from: now };
      if (typing !== null) {
        const n = Math.floor((now - typing.from) / 0.055);
        input.value = typing.text.slice(0, n);
        if (n > typing.text.length + 10) {
          const text = typing.text;
          typing = null;
          send(text);
        }
      }
    }
    stage.drawLetters(now);
    if (now > nextBlink + BLINK.close + BLINK.open) nextBlink = now + 2.5 + Math.random() * 3;
    let grid = stage.home;
    let eyes: EyeLook = { open: blinkFrom(now, nextBlink), fit: stage.fit };
    if (phase === "pour") {
      grid = wait.frame(t, stage.view.stage);
      eyes = eyesOf(wait, t, stage.view.stage)!;
      if (t > POUR && stage.fliers.length === 0) {
        phase = "bud";
        since = now;
      }
    } else if (phase === "bud") {
      if (t < card.end) {
        grid = card.frame(t, stage.view.stage);
        eyes = eyesOf(card, t, stage.view.stage)!;
      } else {
        // Each bud becomes its Cell, and drops to the ground.
        const d = stage.d;
        const spots = spread(
          buds.map((bud) => bud.x / d),
          stage.width / d,
        );
        actors = buds.map((bud, n) => {
          const actor = new Actor(team[n % team.length]!, bud.x / d, bud.bottom / d);
          actor.throwTo(spots[n]!, stage.ground / d, 0.34 + n * 0.05, now);
          actor.say(bud.word, "landed");
          actor.play(["busy/0", "building/0", "reading/0"][n % 3]!, now + 0.6);
          return actor;
        });
        phase = "work";
        since = now;
      }
    } else if (phase === "work") {
      for (const actor of actors) {
        actor.step(dt, now, stage.ground / stage.d, stage.d);
        if (t > WORK) actor.alpha = Math.max(0, 1 - (t - WORK) / 0.6);
        actor.draw(stage.context, now, stage.d);
        actor.drawLabel(stage.context, now, stage.d);
      }
      if (t > WORK + 0.8) {
        actors = [];
        phase = "idle";
        since = now;
      }
    }
    stage.paint(grid, eyes, now);
  };

  stage.onResize = () => {
    stage.fliers.length = 0;
    actors = [];
    phase = "idle";
  };
  if (reduced) {
    input.value = DEMOS[0]!;
    stage.paint(stage.home, { open: 1, fit: stage.fit }, 0);
    return;
  }
  playWhileSeen(root, frame);
}

/** Where Cells dropping from buds at `xs` stand: buds stacked on one side step apart, inside the stage. */
function spread(xs: readonly number[], width: number): number[] {
  const gap = 84;
  const out = [...xs];
  for (const side of [-1, 1]) {
    const mine = xs
      .map((x, n) => [x, n] as const)
      .filter(([x]) => Math.sign(x - width / 2) === side);
    const mean = mine.reduce((sum, [x]) => sum + x, 0) / Math.max(1, mine.length);
    mine.forEach(([, n], k) => {
      const x = mean + (k - (mine.length - 1) / 2) * gap;
      out[n] = Math.min(width - 40, Math.max(40, x));
    });
  }
  return out;
}
