import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { act, use, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { workspaceRoutesOf } from "../../features/layout/workspace-overlay-routes";
import { submittedThreadParams } from "../../features/threads/thread-route-state";
import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";

/**
 * Contract: Input's loop (`inbox/useInbox.ts`) reads, through `openChat.ts`, the workspace's top
 * route under any sheet, a `Thread` naming its chat by `environmentId` and `threadId`, and a home
 * inside the split's primary column. Route names and params are only strings to the type
 * checker, so a change would stop the loop silently.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const source = (path: string) => NodeFS.readFileSync(NodePath.join(here, path), "utf8");

describe("what the home's loop reads", () => {
  it("finds the chat the workspace shows under a sheet over it", () => {
    const thread = { name: "Thread", params: submittedThreadParams("env", "chat") };
    const { workspace } = workspaceRoutesOf([
      { name: "Home" },
      thread,
      { name: "ThreadSettingsSheet" },
    ]);
    expect(workspace.at(-1)).toBe(thread);
    expect(thread.params).toMatchObject({ environmentId: "env", threadId: "chat" });
    expect(source("../../Stack.tsx")).toMatch(
      /\n {4}Thread: createNativeStackScreen\(\{\s*screen: ThreadRouteScreen,\s*linking: \{ path: "threads\/:environmentId\?\/:threadId\?"/,
    );
  });

  it("knows a home in the split's primary column, and none elsewhere", () => {
    const navigator = source("../../features/layout/createWorkspaceStackNavigator.ios.tsx");
    expect(navigator).toMatch(/const primaryColumn = props\.primary\s*\?/);
    expect(navigator).toContain("<NativePrimaryColumnContext value={primaryColumn}>");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const seen: unknown[] = [];
    function Probe() {
      const column = use(NativePrimaryColumnContext);
      useLayoutEffect(() => void seen.push(column));
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
    act(() => root.unmount());
    expect(seen).toEqual([null]);
  });
});
