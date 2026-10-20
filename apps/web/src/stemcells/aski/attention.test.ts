import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import { type Attention, eyesMood, type Home, homeMood } from "./attention.ts";

const home: Home = { present: true, answers: true, chats: [] };
const calm: Attention = { listening: false, waits: false, puzzled: false };

test("nobody at the Mac shuts Aski's eyes, whether or not its server still answers", () => {
  NodeAssert.equal(homeMood({ ...home, present: false }), "asleep");
  NodeAssert.equal(homeMood({ ...home, present: false, answers: false }), "asleep");
});

test("a server that doesn't answer crosses them out", () => {
  NodeAssert.equal(homeMood({ ...home, answers: false }), "crashed");
});

test("Aski is pleased once a Cell has landed and none works or needs the person", () => {
  NodeAssert.equal(homeMood({ ...home, chats: ["done", "done"] }), "pleased");
  NodeAssert.equal(homeMood({ ...home, chats: ["done", "working"] }), undefined);
  NodeAssert.equal(homeMood({ ...home, chats: ["done", "needsYou"] }), undefined);
  NodeAssert.equal(homeMood(home), undefined, "no Cell, no pleasure");
});

test("words typed and a chat waiting keep the cursor over a failed turn and work done, never over nobody home or no answer", () => {
  for (const held of ["asleep", "crashed"] as const) {
    NodeAssert.equal(eyesMood(held, { ...calm, listening: true, waits: true }), held);
  }
  NodeAssert.equal(eyesMood("pleased", { ...calm, listening: true }), undefined);
  NodeAssert.equal(eyesMood("pleased", { ...calm, waits: true }), undefined);
  NodeAssert.equal(eyesMood(undefined, { ...calm, puzzled: true, waits: true }), undefined);
});

test("a failed turn puzzles Aski before work done pleases it", () => {
  NodeAssert.equal(eyesMood("pleased", { ...calm, puzzled: true }), "puzzled");
  NodeAssert.equal(eyesMood(undefined, { ...calm, puzzled: true }), "puzzled");
  NodeAssert.equal(eyesMood("pleased", calm), "pleased");
  NodeAssert.equal(eyesMood(undefined, calm), undefined);
});
