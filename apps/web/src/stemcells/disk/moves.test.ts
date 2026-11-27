import { describe, expect, it } from "vite-plus/test";

import { moveEnded, moveOffer, moveRows, type MovesAnswer } from "./moves";
import type { Drive } from "./wire";

const drive = (id: string, free: number, role: Drive["role"] = "external"): Drive => ({
  id,
  name: id,
  role,
  total: 1e12,
  free,
  detail: null,
  lookInside: false,
  canLookInside: true,
});
const here: MovesAnswer = {
  places: [{ kind: "simulators", title: "Simulators", where: "here" }],
  job: null,
  last: null,
};

describe("moving a finding to another drive", () => {
  it("offers only other drives with room for it, and nothing while a move runs", () => {
    const drives = [drive("Mac", 9e11, "startup"), drive("Roomy", 5e11), drive("Tight", 2e10)];
    expect(moveOffer(here, "simulators", 20e9, drives).map((each) => each.id)).toEqual(["Roomy"]);
    expect(moveOffer(here, "caches", 20e9, drives)).toEqual([]);
    const moving = {
      ...here,
      job: {
        kind: "simulators",
        direction: "away",
        driveName: "Roomy",
        phase: "copying",
        done: 5e9,
        total: 20e9,
      },
    } as const;
    expect(moveOffer(moving, "simulators", 20e9, drives)).toEqual([]);
    expect(moveRows(moving, 0)[0]).toMatchObject({ tone: "working", progress: 0.25 });
  });

  it("gives a folder kept away its way back, or a fresh start when its drive is gone", () => {
    const away = (connected: boolean): MovesAnswer => ({
      places: [
        {
          kind: "simulators",
          title: "Simulators",
          where: "away",
          drive: { id: "d", name: "Spare", connected },
          bytes: 20e9,
        },
      ],
      job: null,
      last: null,
    });
    expect(moveRows(away(true), 0)[0]?.actions.map((action) => action.id)).toEqual(["back"]);
    const gone = moveRows(away(false), 0)[0];
    expect(gone?.tone).toBe("error");
    expect(gone?.actions[0]).toMatchObject({ id: "fresh" });
    expect(gone?.actions[0]?.confirm).toContain("Spare");
  });

  it("names how a watched move ended", () => {
    const before = {
      ...here,
      job: {
        kind: "simulators",
        direction: "away",
        driveName: "Spare",
        phase: "switching",
        done: 1,
        total: 1,
      },
    } as const;
    const after: MovesAnswer = {
      ...here,
      last: { kind: "simulators", direction: "away", ok: false, reason: "No room.", at: 1 },
    };
    expect(moveEnded(before, after)).toEqual({
      ok: false,
      title: "Simulators didn't move",
      description: "No room.",
    });
    expect(moveEnded(here, after)).toBeNull();
  });
});
