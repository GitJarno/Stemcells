import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { isDraftThreadRoute } from "../../features/threads/thread-route-state";

/**
 * Contract: a new task's draft opens as the root stack's `Thread` route,
 * its draft in `draft` (#23467). Settings › Disk opens its cleanup Cell
 * that way (`upstream/disk.ts`); a route name is only a string to the type
 * checker, so a renamed route would fail only when the person taps.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const stack = NodeFS.readFileSync(NodePath.join(here, "../../Stack.tsx"), "utf8");

describe("a draft's route", () => {
  it("is the root's Thread screen, with the draft in its params", () => {
    expect(stack).toMatch(/\n {4}Thread: createNativeStackScreen\(\{\s*screen: ThreadRouteScreen,/);
    expect(isDraftThreadRoute({ name: "Thread", params: { draft: { draftId: "draft" } } })).toBe(
      true,
    );
  });
});
