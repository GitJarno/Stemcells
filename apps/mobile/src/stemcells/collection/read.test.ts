import { expect, it, vi } from "vite-plus/test";

import type { Collection } from "../../../../../stemcells/ledger/feats.ts";
import { chosenLook } from "../../../../web/src/stemcells/cell/chosen.ts";
import { forgetCollectionOf, readCollectionOf } from "./read";

const connection = (host: string) => ({
  httpBaseUrl: `http://${host}.example.com:3773`,
  bearerToken: "token",
});

const saying = (worn: Collection["worn"]): Collection => ({
  feats: [],
  today: { day: "2026-10-23", landings: 0, merges: 0, cells: 0, aloneMs: 0, landed: [] },
  worn,
  seen: [],
  backfilled: true,
});

const answering = (status: number, body?: Collection) =>
  vi.fn<typeof fetch>(async () => Response.json(body ?? null, { status }));

it("wears what each machine's collection says, read at most once a gap, until the machine is gone", async () => {
  const mac = answering(200, saying({ pip: ["outfit:earned/crown"] }));
  await readCollectionOf("mac", connection("mac"), 0, mac);
  await readCollectionOf("mini", connection("mini"), 0, answering(200, saying({ otter: [] })));
  expect(mac.mock.calls[0]?.[0]).toBe("http://mac.example.com:3773/api/stemcells/collection");
  expect(chosenLook("pip")).toEqual(["outfit:earned/crown"]);
  expect(chosenLook("otter")).toEqual([]);

  // Inside the gap the machine isn't asked again; past it, a server with no collection has none.
  const gone = answering(404);
  await readCollectionOf("mac", connection("mac"), 1_000, gone);
  expect(gone).not.toHaveBeenCalled();
  expect(chosenLook("pip")).toEqual(["outfit:earned/crown"]);
  await readCollectionOf("mac", connection("mac"), 60_000, gone);
  expect(chosenLook("pip")).toBeUndefined();

  forgetCollectionOf("mini");
  expect(chosenLook("otter")).toBeUndefined();
});

it("keeps what a machine said last when it can't be reached, and asks none through the relay", async () => {
  await readCollectionOf("den", connection("den"), 0, answering(200, saying({ wren: ["a"] })));
  await readCollectionOf("den", connection("den"), 60_000, answering(503));
  await readCollectionOf("den", connection("den"), 120_000, async () => {
    throw new Error("offline");
  });
  expect(chosenLook("wren")).toEqual(["a"]);
  const relay = answering(200, saying({}));
  await readCollectionOf("far", { ...connection("far"), relayManaged: true }, 0, relay);
  expect(relay).not.toHaveBeenCalled();
  forgetCollectionOf("den");
});
