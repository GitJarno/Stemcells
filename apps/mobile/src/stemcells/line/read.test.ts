import { describe, expect, it, vi } from "vite-plus/test";

import type { askMachine, MachineConnection } from "../upstream/machines";
import { cardOf, type NeedsList } from "./kit";
import { readNeeds } from "./read";

// What asks the machine is the adapter's, with its own test; each case here passes its own.
vi.mock("../upstream/machines", () => ({ askMachine: null }));

const list: NeedsList = {
  needs: [
    {
      key: "t1:request:r1",
      number: 1,
      kind: "permission",
      threadId: "t1",
      projectId: "p1",
      parentThreadId: null,
      title: "Ship it",
      providerInstanceId: "codex",
      since: "2026-10-27T09:00:00.000Z",
      blocks: true,
      request: null,
      plan: null,
      limit: null,
      failure: null,
      prose: null,
      stuck: null,
    },
  ],
  cells: [
    {
      threadId: "t1",
      projectId: "p1",
      title: "Ship it",
      stage: "needs-you",
      line: null,
      createdAt: "2026-10-27T08:00:00.000Z",
    },
  ],
};

const mac: MachineConnection = { environmentId: "mac", reach: "direct" };

/** A machine that answers `status` with `body`, and keeps what it was asked. */
function answering(status: number, body: unknown) {
  const asked: Array<readonly [environmentId: string, path: string]> = [];
  const request: typeof askMachine = async (environmentId, path) => {
    asked.push([environmentId, path]);
    return new Response(JSON.stringify(body), { status });
  };
  return { asked, request };
}

describe("what a machine says of its asks", () => {
  it("is read from the machine's own server", async () => {
    const machine = answering(200, list);
    expect(await readNeeds(mac, null, machine.request)).toEqual({ state: "read", list });
    expect(machine.asked).toEqual([["mac", "/api/stemcells/needs"]]);
  });

  it("has no line for T3's server, T3's relay, or one from before the stages", async () => {
    expect(await readNeeds(mac, null, answering(404, {}).request)).toEqual({ state: "none" });
    const relayed = answering(200, list);
    expect(await readNeeds({ ...mac, reach: "relay" }, null, relayed.request)).toEqual({
      state: "none",
    });
    expect(relayed.asked).toEqual([]);
    const before = answering(200, { needs: list.needs });
    expect(await readNeeds(mac, null, before.request)).toEqual({ state: "none" });
  });

  it("keeps what it said last while it is out of reach", async () => {
    expect(await readNeeds(mac, list, answering(503, {}).request)).toEqual({
      state: "unreachable",
      list,
    });
    // Connecting, or reconnecting, it has no line to ask through.
    const connecting = async () => null;
    expect(await readNeeds({ ...mac, reach: "away" }, list, connecting)).toEqual({
      state: "unreachable",
      list,
    });
    const offline = async () => {
      throw new TypeError("Network request failed");
    };
    expect(await readNeeds(mac, list, offline)).toEqual({ state: "unreachable", list });
  });

  it("reads an ask from a server before an ask's steps, its words the step", async () => {
    const need = list.needs[0]!;
    const prose = { runId: "r1", cue: "left", text: "Sign in to the store." };
    const before = answering(200, { ...list, needs: [{ ...need, kind: "prose", prose }] });
    const reading = await readNeeds(mac, null, before.request);
    if (reading.state !== "read") throw new Error(reading.state);
    expect(cardOf(reading.list.needs[0]!, 0).headline).toBe("Sign in to the store.");
  });

  it("takes only a list with the fields the line reads", async () => {
    for (const body of [{ needs: [{ key: "k" }], cells: [] }, { needs: [], cells: [{}] }, null])
      expect(await readNeeds(mac, null, answering(200, body).request)).toEqual({ state: "none" });
  });
});
