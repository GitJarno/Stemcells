import { describe, expect, it } from "vite-plus/test";

import { cardOf, type NeedsList } from "./kit";
import { readNeeds, type NeedsConnection } from "./read";

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

const mac: NeedsConnection = { httpBaseUrl: "http://mac.example:3773/", bearerToken: "token" };

/** A fetch that answers `status` with `body`, and keeps what it was asked. */
function answering(status: number, body: unknown) {
  const asked: Array<{ url: string; authorization: string | null }> = [];
  const request = (async (url: string, init?: RequestInit) => {
    asked.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { asked, request };
}

describe("what a machine says of its asks", () => {
  it("is read from the machine's own server with the token the phone paired with", async () => {
    const machine = answering(200, list);
    expect(await readNeeds(mac, null, machine.request)).toEqual({ state: "read", list });
    expect(machine.asked).toEqual([
      { url: "http://mac.example:3773/api/stemcells/needs", authorization: "Bearer token" },
    ]);
  });

  it("has no line for T3's server, T3's relay, a connection without a token, or one from before the stages", async () => {
    expect(await readNeeds(mac, null, answering(404, {}).request)).toEqual({ state: "none" });
    const relayed = answering(200, list);
    expect(await readNeeds({ ...mac, relayManaged: true }, null, relayed.request)).toEqual({
      state: "none",
    });
    expect(relayed.asked).toEqual([]);
    expect(await readNeeds({ ...mac, bearerToken: null }, null, relayed.request)).toEqual({
      state: "none",
    });
    const before = answering(200, { needs: list.needs });
    expect(await readNeeds(mac, null, before.request)).toEqual({ state: "none" });
  });

  it("keeps what it said last while it is out of reach", async () => {
    expect(await readNeeds(mac, list, answering(503, {}).request)).toEqual({
      state: "unreachable",
      list,
    });
    const offline = (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch;
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
