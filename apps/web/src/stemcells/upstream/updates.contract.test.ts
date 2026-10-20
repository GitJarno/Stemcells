import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { offeredServerUpdates } from "./updates";

// Contract: Update Everything offers a server update only to a server this
// app runs. Any other server would download T3's build, which Stemcells
// never offers. If this fails after a sync, the shape of an update target
// moved and the filter may let T3's build through.

type Target = Parameters<typeof offeredServerUpdates>[0][number];

const target = (id: string, selfUpdate: Target["selfUpdate"]): Target => ({
  environmentId: EnvironmentId.make(id),
  serverLabel: id,
  selfUpdate,
  installation: undefined,
  desktopAppUpdate: true,
  threadContinuation: false,
  continueThreadsAfterServerUpdate: false,
  targetVersion: "1.2.3",
});

describe("Update Everything in Stemcells", () => {
  it("offers only the app's own server, and lists the rest as needing a manual update", () => {
    const unreachable = [
      { environmentId: EnvironmentId.make("away"), label: "away", reason: "not connected" },
    ];
    const { servers, skipped } = offeredServerUpdates(
      [target("this-app", "desktop-managed"), target("service", "boot-service")],
      unreachable,
    );
    expect(servers.map((server) => server.environmentId)).toEqual(["this-app"]);
    expect(skipped).toEqual([
      ...unreachable,
      { environmentId: "service", label: "service", reason: "needs a manual update" },
    ]);
  });
});
