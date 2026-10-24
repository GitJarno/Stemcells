import * as NetAddress from "effect/net/NetAddress";
import * as Result from "effect/Result";
import { describe, expect, it } from "vite-plus/test";

import { localHostFor } from "./tailscale.ts";

const inet = (address: NetAddress.IpAddress) =>
  Result.getOrThrow(NetAddress.inetAddress(address, 3773));

// Tailscale Serve proxies to this host: it has to be one the server answers on.
describe("upstream: the loopback host of a listening server", () => {
  it("is 127.0.0.1 for a server on IPv4 loopback or every interface, [::1] for IPv6 loopback", () => {
    expect(localHostFor(inet(NetAddress.ipv4Loopback))).toBe("127.0.0.1");
    expect(localHostFor(inet(NetAddress.ipv4Unspecified))).toBe("127.0.0.1");
    expect(localHostFor(inet(NetAddress.ipv6Loopback))).toBe("[::1]");
  });
});
