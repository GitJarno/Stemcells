import { describe, expect, it, vi } from "vite-plus/test";

import { ownTeam } from "./ownTeam";
import { registerWith } from "./register";

const device = {
  token: "aa11",
  environment: "production" as const,
  topic: "com.example.cells",
  label: "Phone",
};
const mac = { httpBaseUrl: "http://mac.example.ts.net:3773/", bearerToken: "paired" };

describe("registerWith", () => {
  it("asks the Mac for pushes with the connection's own credentials", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    expect(await registerWith(mac, device, request)).toBe("registered");
    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe("http://mac.example.ts.net:3773/api/stemcells/push/devices");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer paired");
    expect(init?.body).toBe(JSON.stringify(device));
  });

  it("tells a server without pushes from one that refused, and one out of reach", async () => {
    const answering = (status: number) => async () => new Response(null, { status });
    expect(await registerWith(mac, device, answering(404))).toBe("not-stemcells");
    expect(await registerWith(mac, device, answering(403))).toBe("refused");
    const offline = async (): Promise<Response> => {
      throw new TypeError("Network request failed");
    };
    expect(await registerWith(mac, device, offline)).toBe("unreachable");
    expect(await registerWith({ ...mac, bearerToken: null }, device, answering(204))).toBe(
      "refused",
    );
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
