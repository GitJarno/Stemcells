import { describe, expect, it } from "vite-plus/test";

import { workspaceTabNavigationState } from "../../features/workspace/workspace-tab-navigation";

/**
 * Contract: the Threads tab opened without columns leaves Home alone on the root stack, under its
 * own key, even while the tab remembers the chat. A chat settled on another device gives way to
 * the home that way (`useShowHome`, `upstream/home.ts`); were the chat kept, it would stay open.
 */

const home = { key: "home", name: "Home" };
const chat = { key: "chat", name: "Thread", params: { environmentId: "env", threadId: "otter" } };

describe("the home brought to the front", () => {
  it("is Home alone, the chat gone from the stack and the detail column", () => {
    const next = workspaceTabNavigationState(
      { index: 1, routes: [home, chat] },
      "threads",
      { threads: chat.params },
      { columns: false, check: { thread: () => true, pullRequest: () => true } },
    );
    expect(next.routes).toEqual([home]);
    expect(next.index).toBe(0);
  });
});
