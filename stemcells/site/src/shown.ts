// 02 · Shown, not told. One reply as an agent would write it: a wall of
// words, in the app's own pane. The same pane wipes it into the answer as the
// app draws it, then shows the other forms an answer takes. The count is the
// words left to read.

import { along, Exhibit } from "./kit/exhibit.ts";
import { ease, lerp, span } from "./kit/form.ts";
import { scene } from "./kit/scenes.ts";
import { band, type Box, part, type ShotName, VIEW, WORDS } from "./shots.ts";

/** The wall, then the forms in the order the page lists them: each a screen, and where the camera rests on it. */
type Staging = readonly (readonly [ShotName, Box])[];
const DESK: Staging = [
  ["shown-wall", VIEW.answer],
  ["shown-chart", VIEW.answer],
  ["shown-diagram", VIEW.answer],
  ["shown-choice", VIEW.foot],
  ["shown-closeout", VIEW.answer],
];
/** On a phone the camera only looks down the chat, to the answer's own block. */
const down = (shot: ShotName, name: string, h = part(shot, name).h): Box =>
  band(part(shot, name).y, h);
const HAND: Staging = [
  ["shown-wall-phone", down("shown-chart-phone", "reply")],
  ["shown-chart-phone", down("shown-chart-phone", "reply")],
  ["shown-diagram-phone", down("shown-diagram-phone", "reply")],
  ["shown-choice-phone", down("shown-choice-phone", "question", 180)],
  ["shown-closeout-phone", down("shown-closeout-phone", "reply")],
];

/** The story's beats along the scroll: the wipe, each turn to the next form, a turn's length, the camera's move after it. */
const AT = { wipe: 0.12, wiped: 0.34, turns: [0.5, 0.66, 0.8], turn: 0.016, pan: 0.05 } as const;
/** Reduce Motion's still: the chart, drawn. */
const STILL = 0.42;

export function shown(root: HTMLElement): void {
  // A Mac's window and a phone's screen: only the one this visitor's screen calls for shows, and loads.
  const host = root.querySelector<HTMLElement>(".window")!;
  const windows = [
    [
      DESK,
      new Exhibit(
        host,
        DESK.map(([shot]) => shot),
        { on: "desk" },
      ),
    ],
    [
      HAND,
      new Exhibit(
        host,
        HAND.map(([shot]) => shot),
        { on: "hand" },
      ),
    ],
  ] as const;
  let [staged, app] = windows[0];
  const listed = [...root.querySelectorAll<HTMLElement>(".forms li")];
  const tally = root.querySelector<HTMLElement>(".count")!;
  const count = tally.querySelector<HTMLElement>("b")!;
  let lit = -2,
    said = -1;

  scene(
    root,
    (f) => {
      const { p } = f;
      if (f.fresh) [staged, app] = windows[windows[1][1].showing ? 1 : 0];

      const wiped = ease.inOut(span(p, AT.wipe, AT.wiped));
      const turned = AT.turns.reduce((sum, at) => sum + span(p, at, at + AT.turn), 0);
      if (turned <= 0) app.wipe(1, wiped);
      else app.turn(1 + turned);

      // A screen turns in place while the camera rests; then the camera goes to where the new one answers.
      app.look(
        along(
          AT.turns.flatMap((at, n) => [
            [at + AT.turn, staged[n + 1]![1]] as const,
            [at + AT.turn + AT.pan, staged[n + 2]![1]] as const,
          ]),
          p,
        ),
      );

      const now = wiped < 0.5 ? -1 : Math.round(turned);
      if (now !== lit) {
        lit = now;
        listed.forEach((item, n) => item.classList.toggle("on", n === now));
      }
      // The count holds for the one answer told two ways: the wall, then its chart.
      const read = Math.round(lerp(WORDS["shown-wall"]!, WORDS["shown-chart"]!, wiped));
      if (read !== said) {
        said = read;
        count.textContent = `${read}`;
      }
      tally.style.opacity = `${1 - span(p, AT.turns[0] - 0.04, AT.turns[0])}`;
    },
    { still: STILL },
  );
}
