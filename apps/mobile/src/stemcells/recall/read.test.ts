import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { RecallAnswer } from "./kit";
import { forgetRecall, readRecallOf } from "./read";

// Friday 27 November 2026, three in the afternoon, on the phone's own clock.
const SENT = new Date(2026, 10, 27, 15).getTime();

const ANSWER: RecallAnswer = {
  cards: [],
  more: 0,
  read: { from: null, to: null, project: null, words: ["film", "page"], widened: false },
};

const machine = () => vi.fn(async (_environmentId: string, _path: string) => Response.json(ANSWER));

describe("the Cells a question put to Aski finds, on the phone", () => {
  beforeEach(forgetRecall);

  it("are asked of the chat's own machine once a message, with the window its day reads", async () => {
    const ask = machine();
    await readRecallOf(
      "environment-mac",
      "message-1",
      "what did we do in Harbor yesterday",
      SENT,
      ask,
    );
    await readRecallOf(
      "environment-mac",
      "message-1",
      "what did we do in Harbor yesterday",
      SENT,
      ask,
    );
    const from = new Date(2026, 10, 26).getTime();
    const to = new Date(2026, 10, 27).getTime();
    expect(ask.mock.calls).toEqual([
      [
        "environment-mac",
        `/api/stemcells/recall?query=what%20did%20we%20do%20in%20Harbor%20yesterday&limit=6&from=${from}&to=${to}`,
      ],
    ]);
  });

  it("are not asked for under a message that asks nothing about the past", async () => {
    const ask = machine();
    await readRecallOf(
      "environment-mac",
      "message-2",
      "a Fable Cell on high for the product page",
      SENT,
      ask,
    );
    expect(ask).not.toHaveBeenCalled();
  });
});
