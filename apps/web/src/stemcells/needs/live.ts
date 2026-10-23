/**
 * The page's one list view and one set of holds, wired to the server's
 * stream, upstream's commands and the timing tokens. A closing window sends
 * what is still held: the person chose it, and the fuse was only there to
 * take it back.
 */
import { sendThreadCommand } from "../upstream/needs";
import { timing } from "../tokens/motion";
import { createHolds } from "./holds";
import { createPage } from "./page";
import { readNeeds, subscribeNeeds } from "./stream";

export const holds = createHolds({
  send: sendThreadCommand,
  needs: readNeeds,
  keepLive: () => subscribeNeeds(() => {}),
  now: () => Date.now(),
  window: () => timing("answerUndo"),
});

export const page = createPage({
  needs: readNeeds,
  subscribeNeeds,
  now: () => Date.now(),
  linger: () => timing("linger"),
  clearedFor: () => timing("bannerStay"),
});

if (typeof window !== "undefined") window.addEventListener("pagehide", () => holds.flush());
