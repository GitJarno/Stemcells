/**
 * A thread chip in a chat opens the chat it names beside the one being read:
 * the route stays on the chat the person is in, where upstream's chip routed
 * away from it and the focused pane lost its chat.
 */
import "../../../index.css";

import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { provideCellBeside } from "../../tabs/commands";
import type { CellRef } from "../../tabs/layout";
import { render } from "../testRender";
import { ThreadContextChip } from "./ThreadContextChip";

const record = {
  environmentId: "env" as EnvironmentId,
  threadId: "linked" as ThreadId,
  title: "Linked chat",
};

describe("a thread chip", () => {
  it("opens its chat beside the one being read, which keeps the route", async () => {
    const opened: CellRef[] = [];
    using _beside = { [Symbol.dispose]: provideCellBeside((cell) => opened.push(cell)) };
    await using screen = await render(<ThreadContextChip record={record} />, {
      router: "/env/reading",
    });
    await userEvent.click(screen.getByRole("link", { name: "Thread, Linked chat" }));
    expect(opened).toEqual([{ environmentId: "env", threadId: "linked", draftId: null }]);
    expect(screen.router!.state.location.pathname).toBe("/env/reading");
  });

  it("routes to its chat as upstream's does outside the workspace", async () => {
    await using screen = await render(<ThreadContextChip record={record} />, {
      router: "/env/reading",
    });
    await userEvent.click(screen.getByRole("link", { name: "Thread, Linked chat" }));
    await expect.poll(() => screen.router!.state.location.pathname).toBe("/env/linked");
  });
});
