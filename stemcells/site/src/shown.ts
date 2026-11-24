// 02 · Shown, not told. One reply as an agent would write it: a wall of
// words, in the app's own pane. The same pane wipes it into the answer as the
// app draws it, then shows the other forms an answer takes. The count is the
// words left to read.

import { along, Exhibit } from "./kit/exhibit.ts";
import { ease, lerp, span } from "./kit/form.ts";
import { scene } from "./kit/scenes.ts";
import { type ShotName, VIEW, WORDS } from "./shots.ts";

/** The forms, in the order the page lists them. */
const FORMS: readonly ShotName[] = [
  "shown-chart",
  "shown-diagram",
  "shown-choice",
  "shown-closeout",
];
const WALL: ShotName = "shown-wall";

/** The story's beats along the scroll: the wipe, then each turn to the next form. */
const AT = { wipe: 0.12, wiped: 0.34, turns: [0.5, 0.66, 0.8], turn: 0.016 } as const;
/** Reduce Motion's still: the chart, drawn. */
const STILL = 0.42;

export function shown(root: HTMLElement): void {
  const app = new Exhibit(root.querySelector<HTMLElement>(".window")!, [WALL, ...FORMS]);
  const listed = [...root.querySelectorAll<HTMLElement>(".forms li")];
  const tally = root.querySelector<HTMLElement>(".count")!;
  const count = tally.querySelector<HTMLElement>("b")!;
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

      // The camera rests on the answer; it goes down to the composer before the choice appears there, and back after.
      const [, toChoice, toClose] = AT.turns;
      app.look(
        along(
          [
            [toChoice - 0.07, VIEW.answer],
            [toChoice - 0.01, VIEW.foot],
            [toClose + AT.turn, VIEW.foot],
            [toClose + AT.turn + 0.06, VIEW.answer],
          ],
          p,
        ),
      );

      const now = wiped < 0.5 ? -1 : Math.round(turned);
      if (now !== lit) {
        lit = now;
        listed.forEach((item, n) => item.classList.toggle("on", n === now));
      }
      // The count holds for the one answer told two ways: the wall, then its chart.
      const read = Math.round(lerp(WORDS[WALL]!, WORDS[FORMS[0]!]!, wiped));
      if (read !== said) {
        said = read;
        count.textContent = `${read}`;
      }
      tally.style.opacity = `${1 - span(p, AT.turns[0] - 0.04, AT.turns[0])}`;
    },
    { still: STILL },
  );
}
