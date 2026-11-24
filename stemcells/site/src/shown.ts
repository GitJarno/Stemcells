// 02 · Shown, not told. One reply as an agent would write it: a wall of
// words, in the app's own pane. The same pane wipes it into the answer as the
// app draws it, then shows the other forms an answer takes. The count is the
// words left to read.

import { around, between, Exhibit } from "./kit/exhibit.ts";
import { ease, lerp, span } from "./kit/form.ts";
import { scene } from "./kit/scenes.ts";
import { type Box, part, type ShotName, WORDS } from "./shots.ts";

/** The forms, in the order the page lists them: the screen, and the part of it that is the form. */
const FORMS: readonly { shot: ShotName; part: string }[] = [
  { shot: "shown-chart", part: "chart" },
  { shot: "shown-diagram", part: "diagram" },
  { shot: "shown-choice", part: "question" },
  { shot: "shown-closeout", part: "closeOut" },
];
const WALL: ShotName = "shown-wall";

/** The story's beats along the scroll: the wipe, then each turn to the next form. */
const AT = { wipe: 0.12, wiped: 0.34, turns: [0.5, 0.66, 0.82], turn: 0.05 } as const;
/** Reduce Motion's still: the chart, drawn. */
const STILL = 0.42;

export function shown(root: HTMLElement): void {
  const app = new Exhibit(root.querySelector<HTMLElement>(".window")!, [
    WALL,
    ...FORMS.map((form) => form.shot),
  ]);
  const listed = [...root.querySelectorAll<HTMLElement>(".forms li")];
  const count = root.querySelector<HTMLElement>(".count b")!;
  let lit = -2,
    said = -1;

  scene(
    root,
    (f) => {
      const { p } = f;
      const wiped = ease.inOut(span(p, AT.wipe, AT.wiped));
      const turned = AT.turns.reduce((sum, at) => sum + ease.inOut(span(p, at, at + AT.turn)), 0);
      if (turned <= 0) app.wipe(1, wiped);
      else app.turn(1 + turned);

      // The camera: the whole reply while it is a wall, then in on each form.
      const hand = f.form === "phone";
      const focus = (n: number): Box => {
        const form = FORMS[Math.min(n, FORMS.length - 1)]!;
        return around(part(form.shot, form.part), hand ? 14 : 110);
      };
      const from = Math.floor(turned);
      const on = between(focus(from), focus(from + 1), turned - from);
      const lean = ease.inOut(span(p, AT.wiped, AT.wiped + 0.08)) * (hand ? 1 : 0.45);
      app.look(between(part(WALL, "reply"), on, lean));

      const now = wiped < 0.5 ? -1 : Math.round(turned);
      if (now !== lit) {
        lit = now;
        listed.forEach((item, n) => item.classList.toggle("on", n === now));
      }
      const read =
        turned > 0
          ? lerp(WORDS[FORMS[from]!.shot]!, WORDS[focusShot(from + 1)]!, turned - from)
          : lerp(WORDS[WALL]!, WORDS[FORMS[0]!.shot]!, wiped);
      if (Math.round(read) !== said) {
        said = Math.round(read);
        count.textContent = `${said}`;
      }
    },
    { still: STILL },
  );
}

const focusShot = (n: number): ShotName => FORMS[Math.min(n, FORMS.length - 1)]!.shot;
