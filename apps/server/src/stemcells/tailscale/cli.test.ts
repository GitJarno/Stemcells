import { describe, expect, it } from "vite-plus/test";

import { authUrlOf, consentUrlOf, phonesOf, stepOf } from "./cli.ts";

const ports = { localHost: "127.0.0.1", localPort: 3773, servePort: 443 };

const status = (backendState: string, self: Record<string, unknown> = {}) =>
  JSON.stringify({
    BackendState: backendState,
    Self: { DNSName: "mac.example.ts.net.", CapMap: { https: null }, ...self },
  });
const serving = (proxy: string, host = "mac.example.ts.net:443") =>
  JSON.stringify({
    TCP: { 443: { HTTPS: true } },
    Web: { [host]: { Handlers: { "/": { Proxy: proxy } } } },
  });

describe("where a phone's way in over Tailscale stands", () => {
  it("is ready only once Serve sends the tailnet name to this server", () => {
    expect(stepOf(status("Running"), serving("http://127.0.0.1:3773"), ports)).toEqual({
      kind: "ready",
      baseUrl: "https://mac.example.ts.net",
    });
    // Another app's Serve on the port is never taken over.
    expect(stepOf(status("Running"), serving("http://127.0.0.1:8080"), ports)).toEqual({
      kind: "port-taken",
      port: 443,
    });
    expect(
      stepOf(
        status("Running"),
        JSON.stringify({ TCP: { 443: { TCPForward: "127.0.0.1:22" } } }),
        ports,
      ),
    ).toEqual({ kind: "port-taken", port: 443 });
    expect(stepOf(status("Running"), "{}", ports)).toEqual({ kind: "not-serving" });
  });

  it("asks for the tailnet's HTTPS while the tailnet lacks it", () => {
    expect(stepOf(status("Running", { CapMap: { "ssh-behavior-v1": null } }), "{}", ports)).toEqual(
      {
        kind: "https-off",
      },
    );
  });

  it("tells a stopped app, a missing sign-in and a connecting one apart", () => {
    expect(stepOf(null, null, ports)).toEqual({ kind: "stopped" });
    expect(stepOf("failed to connect to local Tailscale service", null, ports)).toEqual({
      kind: "stopped",
    });
    expect(stepOf(status("Stopped"), null, ports)).toEqual({ kind: "stopped" });
    expect(stepOf(status("NeedsLogin"), null, ports)).toEqual({ kind: "signed-out" });
    expect(stepOf(status("Starting"), null, ports)).toEqual({ kind: "starting" });
  });

  it("keeps a port other than 443 in the address", () => {
    expect(
      stepOf(status("Running"), serving("http://127.0.0.1:3773", "mac.example.ts.net:8443"), {
        ...ports,
        servePort: 8443,
      }),
    ).toEqual({ kind: "ready", baseUrl: "https://mac.example.ts.net:8443" });
  });
});

describe("the pages Tailscale names", () => {
  it("takes the HTTPS switch from serve's output, once its line is whole, and never the served address", () => {
    const consent =
      "Serve is not enabled on your tailnet.\nTo enable, visit:\n\n         https://login.tailscale.com/f/serve?node=n123\n";
    expect(consentUrlOf(consent)).toBe("https://login.tailscale.com/f/serve?node=n123");
    expect(consentUrlOf(consent.trimEnd())).toBeNull();
    expect(
      consentUrlOf(
        "Available within your tailnet:\n\nhttps://mac.example.ts.net/\n|-- proxy http://127.0.0.1:3773\n",
      ),
    ).toBeNull();
  });

  it("takes a sign-in under way from the status", () => {
    expect(
      authUrlOf(
        JSON.stringify({
          BackendState: "NeedsLogin",
          AuthURL: "https://login.tailscale.com/a/abc",
        }),
      ),
    ).toBe("https://login.tailscale.com/a/abc");
    expect(authUrlOf(JSON.stringify({ BackendState: "NeedsLogin", AuthURL: "" }))).toBeNull();
  });
});

describe("the phones on this computer's tailnet", () => {
  const tailnet = (peers: Record<string, Record<string, unknown>>) =>
    JSON.stringify({
      BackendState: "Running",
      Self: { DNSName: "mac.example.ts.net.", UserID: 7, OS: "macOS" },
      User: { 7: { LoginName: "person@example.com" } },
      Peer: peers,
    });

  it("lists none on a tailnet of this computer alone, with the account a phone signs in with", () => {
    expect(phonesOf(tailnet({}))).toEqual({ account: "person@example.com", phones: [] });
  });

  it("lists phones and tablets only, and whether their Tailscale is on", () => {
    expect(
      phonesOf(
        tailnet({
          a: { HostName: "Work laptop", OS: "linux", Online: true },
          b: { HostName: "Phone", OS: "iOS", Online: false },
          c: {
            HostName: "localhost",
            DNSName: "tablet.example.ts.net.",
            OS: "android",
            Online: true,
          },
        }),
      ).phones,
    ).toEqual([
      { name: "Phone", online: false },
      { name: "tablet", online: true },
    ]);
  });

  it("knows nothing without Tailscale's answer", () => {
    expect(phonesOf(null)).toEqual({ account: null, phones: [] });
  });
});
