import { describe, expect, it } from "vite-plus/test";

import { registerThreadDismissal, withThreadDismissal } from "../../features/home/thread-dismissal";

/**
 * Contract: T3 runs each row action that moves a chat (sleep, wake, snooze, pin, archive) through
 * `withThreadDismissal`, which calls every dismissal registered for the chat's key before it sends
 * the move, and the way back when the move fails. A Cell lifts out of its row there (`home/hops.ts`).
 */
describe("a row's dismissal", () => {
  it("starts before the move is sent, and comes back when the move fails", async () => {
    const said: string[] = [];
    const unregister = registerThreadDismissal("env:chat", () => {
      said.push("lifts");
      return { finished: Promise.resolve(), restore: () => said.push("back") };
    });
    await withThreadDismissal(
      "env:chat",
      async () => said.push("sent"),
      () => true,
    );
    await withThreadDismissal(
      "env:chat",
      async () => said.push("sent"),
      () => false,
    );
    await withThreadDismissal(
      "env:other",
      async () => said.push("other"),
      () => true,
    );
    unregister();
    expect(said).toEqual(["lifts", "sent", "lifts", "sent", "back", "other"]);
  });
});
