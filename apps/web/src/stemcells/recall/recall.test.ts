import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { RecallAnswer } from "../../../../../stemcells/recall/card.ts";
import { forgetRecall, readRecall } from "./recall";

// Friday 27 November 2026, three in the afternoon, on this machine's own clock.
const SENT = new Date(2026, 10, 27, 15).getTime();

const ANSWER: RecallAnswer = {
  cards: [],
  more: 0,
  read: { from: null, to: null, project: null, words: ["film", "page"], widened: false },
};

const server = () =>
  vi.fn(async (_path: string, _query?: Record<string, string>) => Response.json(ANSWER));

describe("the Cells a question put to Aski finds", () => {
  beforeEach(forgetRecall);

  it("are asked for once a message, with the window the message's own day reads", async () => {
    const get = server();
    await readRecall("message-1", "where was the film page chat yesterday?", SENT, get);
    // Drawn again, as a list does when it scrolls: no second read.
    await readRecall("message-1", "where was the film page chat yesterday?", SENT, get);
    expect(get.mock.calls).toEqual([
      [
        "/api/stemcells/recall",
        {
          query: "where was the film page chat yesterday?",
          limit: "6",
          from: String(new Date(2026, 10, 26).getTime()),
          to: String(new Date(2026, 10, 27).getTime()),
        },
      ],
    ]);
  });

  it("are not asked for under a message that asks nothing about the past", async () => {
    const get = server();
    await readRecall("message-2", "a Fable Cell on high for the product page", SENT, get);
    await readRecall("message-3", "turn the sounds off", SENT, get);
    expect(get).not.toHaveBeenCalled();
  });
});
