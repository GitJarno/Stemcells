import { describe, expect, it } from "vite-plus/test";

import { proposedPlan } from "../../../../../../stemcells/orchestrator/check.ts";
import { PLAN_PATH } from "../../../../../../stemcells/orchestrator/wire.ts";
import { fenceReader } from "./fence";
import { makeTrays } from "./trays";

/** A plan as `stemcells_propose` makes it on the server. */
const proposed = proposedPlan({
  id: "plan-proposed-1",
  cells: [
    {
      projectId: "p-harbor",
      projectName: "Harbor",
      title: "Tidy the tokens",
      words: "Tidy the design tokens.",
    },
    {
      projectId: "p-atlas",
      projectName: "Atlas",
      title: "Write the docs",
      words: "Write the docs for the parser.",
    },
  ],
  mint: (() => {
    let n = 0;
    return () => `thread-${n++}`;
  })(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("a ```plan fence reading its plan", () => {
  it("asks the chat's machine once and shows every Cell waiting, by Aski's words", async () => {
    const trays = makeTrays();
    const asked: string[] = [];
    const open = fenceReader(
      trays,
      async (environmentId, path) => {
        asked.push(`${environmentId} ${path}`);
        return json({ plan: proposed, outcome: null });
      },
      () => {},
    );
    // Two views of the same fence ask together.
    await expect(
      Promise.all([open("mac", proposed.id), open("mac", proposed.id)]),
    ).resolves.toEqual(["plan", "plan"]);
    expect(asked).toEqual([`mac ${PLAN_PATH}?id=plan-proposed-1`]);
    const entry = trays.read().get(proposed.id);
    expect(entry).toMatchObject({ door: "fence", environmentId: "mac", state: "tray" });
    expect(entry?.tray?.acts.map((one) => one.status)).toEqual(["waiting", "waiting"]);
    expect(entry?.tray?.acts.map((one) => one.act.why)).toEqual([["proposed"], ["proposed"]]);
    // Seen again, it is read from the phone's own store.
    await open("mac", proposed.id);
    expect(asked).toHaveLength(1);
  });

  it("shows a Cell already started as started, not as one to start again", async () => {
    const trays = makeTrays();
    const open = fenceReader(
      trays,
      async () =>
        json({
          plan: proposed,
          outcome: [
            { i: 0, status: "started" },
            { i: 1, status: "waiting" },
          ],
        }),
      () => {},
    );
    await open("mac", proposed.id);
    expect(
      trays
        .read()
        .get(proposed.id)
        ?.tray?.acts.map((one) => one.status),
    ).toEqual(["started", "waiting"]);
  });

  it("says a plan the server has forgotten is gone", async () => {
    const trays = makeTrays();
    const open = fenceReader(
      trays,
      async () => json({ error: "No such plan." }, 404),
      () => {},
    );
    await expect(open("mac", "plan-old-12345")).resolves.toBe("gone");
    expect(trays.read().get("plan-old-12345")?.state).toBe("gone");
  });

  it("holds nothing when the machine can't be reached, so the next look asks again", async () => {
    const trays = makeTrays();
    let reachable = false;
    const open = fenceReader(
      trays,
      async () => (reachable ? json({ plan: proposed, outcome: null }) : null),
      () => {},
    );
    await expect(open("mac", proposed.id)).resolves.toBe("unreachable");
    expect(trays.read().size).toBe(0);
    reachable = true;
    await expect(open("mac", proposed.id)).resolves.toBe("plan");
  });
});
