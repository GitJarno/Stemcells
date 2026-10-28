import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { offeredServerUpdates, updateStep, type DesktopUpdateState } from "./updates";

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

// Contract: the column's banner reads where the app's update stands from
// upstream's own reading of the desktop's state (its pill's action). If this
// fails after a sync, the banner may show with nothing to take, or miss one.

const state = (patch: Partial<DesktopUpdateState>): DesktopUpdateState => ({
  enabled: true,
  status: "up-to-date",
  channel: "nightly",
  currentVersion: "0.1.1-nightly.20261024.7266",
  hostArch: "arm64",
  appArch: "arm64",
  runningUnderArm64Translation: false,
  availableVersion: null,
  downloadedVersion: null,
  releaseNotes: [],
  omittedReleaseCount: 0,
  downloadPercent: null,
  checkedAt: null,
  message: null,
  errorContext: null,
  canRetry: false,
  ...patch,
});

describe("where the app's update stands", () => {
  const next = "0.1.1-nightly.20261026.7271";

  it("is nothing to take while up to date, checking, or when the check failed", () => {
    expect(updateStep(state({}))).toBeNull();
    expect(updateStep(state({ status: "checking" }))).toBeNull();
    expect(updateStep(state({ status: "error", errorContext: "check" }))).toBeNull();
    expect(updateStep(state({ status: "disabled", enabled: false }))).toBeNull();
  });

  it("downloads one that's available, or whose download failed", () => {
    expect(updateStep(state({ status: "available", availableVersion: next }))).toBe("download");
    expect(
      updateStep(state({ status: "error", errorContext: "download", availableVersion: next })),
    ).toBe("download");
  });

  it("shows one downloading, and restarts into one downloaded, or whose install failed", () => {
    expect(updateStep(state({ status: "downloading", availableVersion: next }))).toBe(
      "downloading",
    );
    expect(updateStep(state({ status: "downloaded", downloadedVersion: next }))).toBe("restart");
    expect(
      updateStep(state({ status: "error", errorContext: "install", downloadedVersion: next })),
    ).toBe("restart");
  });
});
