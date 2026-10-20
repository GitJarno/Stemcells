import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import fixtureJson from "./fixtures/stage.json" with { type: "json" };
import {
  type Cast,
  cast,
  type Entry,
  joinAngle,
  type Metrics,
  ORBIT,
  orbitOf,
  orbitPose,
  spotPoint,
} from "./stage.ts";

interface Step {
  cells: { name: string; stage: string; born: number; needSince?: number; closing?: boolean }[];
  orbit: string[];
  ground: { trailing: string[]; leading: string[] };
  front: string[];
  entries: Record<string, Entry>;
  left: string[];
}

const fixture = fixtureJson as { cases: { says: string; steps: Step[] }[] };

test("each Cell stands where its stage puts it, keeps its spot, and comes and goes through Aski", () => {
  for (const c of fixture.cases) {
    let before: Cast | undefined;
    for (const [n, step] of c.steps.entries()) {
      const casting = cast(
        before,
        step.cells.map((cell) => ({
          key: cell.name,
          stage: cell.stage,
          bornAt: cell.born,
          closing: cell.closing === true,
          ...(cell.needSince === undefined ? {} : { needSince: cell.needSince }),
        })),
      );
      before = casting.cast;
      const at = `${c.says}, step ${n + 1}`;
      NodeAssert.deepEqual(casting.cast.orbit, step.orbit, at);
      NodeAssert.deepEqual(casting.cast.ground, step.ground, at);
      NodeAssert.deepEqual(casting.cast.front, step.front, at);
      NodeAssert.deepEqual(
        Object.fromEntries([...casting.spots].map(([k, s]) => [k, s.entry])),
        step.entries,
        at,
      );
      NodeAssert.deepEqual(casting.left, step.left, at);
    }
  }
});

const STAGE: Metrics = { width: 354, aski: 132, cell: { width: 26, height: 20 }, gap: 6 };
const apart = (a: number, b: number): number => {
  const d = (((a - b) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
};

test("Cells joining the orbit together come in front of Aski, each clear of the others", () => {
  const o = orbitOf(STAGE);
  const from = spotPoint({ place: "ground", side: "trailing", index: 0, of: 1 }, STAGE);
  const taken: number[] = [];
  for (let n = 0; n < 4; n++) {
    const angle = joinAngle(o, STAGE, from, taken);
    NodeAssert.ok(Math.sin(angle) >= 0, `joins in front of Aski, not behind it (${angle})`);
    for (const other of taken)
      NodeAssert.ok(apart(angle, other) >= ORBIT.gap - 1e-9, `clear of ${other}: ${angle}`);
    taken.push(angle);
  }
});

test("a Cell changes between its copies under and over Aski only at the orbit's ends, clear of Aski", () => {
  // A Cell changes from its near copy to its far one at the orbit's ends; there it must stand clear of Aski's ink.
  const o = orbitOf(STAGE);
  for (const end of [0, Math.PI]) {
    const pose = orbitPose(o, STAGE, end);
    NodeAssert.ok(
      Math.abs(pose.x) - (STAGE.cell.width * pose.scale) / 2 > STAGE.aski / 2,
      `at angle ${end}`,
    );
  }
});

test("on a stage given room, the orbit sweeps out across it, never tighter than the narrow one, at the same pace along its line", () => {
  const narrow = orbitOf(STAGE);
  const wide = orbitOf({ ...STAGE, width: 672 }, true);
  NodeAssert.ok(wide.rx > narrow.rx * 2, `swept out: ${wide.rx}`);
  NodeAssert.ok(wide.rx <= 672 / 2, "inside the stage");
  // Along the line, a Cell goes as fast in either: a wider orbit takes longer to go round.
  const pace = (o: { rx: number; period: number }) => o.rx / o.period;
  NodeAssert.ok(Math.abs(pace(wide) - pace(narrow)) < 1e-9);
  // Too narrow a stage to sweep keeps the narrow orbit's size.
  NodeAssert.equal(orbitOf({ ...STAGE, width: 100 }, true).rx, narrow.rx);
  // Its ends stay clear of Aski, so a Cell changes between its copies out of sight.
  for (const end of [0, Math.PI]) {
    const pose = orbitPose(wide, STAGE, end);
    NodeAssert.ok(Math.abs(pose.x) - (STAGE.cell.width * pose.scale) / 2 > STAGE.aski / 2);
  }
});
