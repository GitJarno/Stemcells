import { describe, expect, it, vi } from "vite-plus/test";

import type { askMachine, MachineConnection } from "../upstream/machines";
import { ownTeam } from "./ownTeam";
import { registerWith } from "./register";

// What asks the machine is the adapter's, with its own test; each case here passes its own.
vi.mock("../upstream/machines", () => ({ askMachine: null }));

const device = {
  token: "aa11",
  environment: "production" as const,
  topic: "com.example.cells",
  label: "Phone",
};
const mac: MachineConnection = { environmentId: "mac", reach: "direct" };

describe("registerWith", () => {
  it("asks the Mac for pushes to this phone", async () => {
    const ask = vi.fn<typeof askMachine>(async () => new Response(null, { status: 204 }));
    expect(await registerWith(mac, device, ask)).toBe("registered");
    expect(ask).toHaveBeenCalledExactlyOnceWith("mac", "/api/stemcells/push/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(device),
    });
  });

  it("tells a server without pushes from one that refused, and one out of reach", async () => {
    const answering = (status: number) => async () => new Response(null, { status });
    expect(await registerWith(mac, device, answering(404))).toBe("not-stemcells");
    expect(await registerWith(mac, device, answering(403))).toBe("refused");
    const offline = async (): Promise<Response> => {
      throw new TypeError("Network request failed");
    };
    expect(await registerWith(mac, device, offline)).toBe("unreachable");
    const connecting = async () => null;
    expect(await registerWith({ ...mac, reach: "away" }, device, connecting)).toBe("unreachable");
  });
});

describe("ownTeam", () => {
  it("is upstream's build until both are set, and refuses a half or a wrong one", () => {
    expect(ownTeam({})).toBeNull();
    expect(
      ownTeam({
        STEMCELLS_IOS_TEAM_ID: "TEAM123456",
        STEMCELLS_IOS_BUNDLE_ID: "com.example.cells",
      }),
    ).toEqual({ teamId: "TEAM123456", bundleIdentifier: "com.example.cells" });
    expect(() => ownTeam({ STEMCELLS_IOS_TEAM_ID: "TEAM123456" })).toThrow();
    expect(() =>
      ownTeam({ STEMCELLS_IOS_TEAM_ID: "team", STEMCELLS_IOS_BUNDLE_ID: "com.example.cells" }),
    ).toThrow();
  });
});
