import { describe, expect, it, vi } from "vite-plus/test";

import type { EnvironmentId } from "../upstream/machines";
import { linkMachines } from "./linking";

const calls = vi.hoisted(() => ({
  made: [] as Array<{
    readonly environmentId: string;
    readonly path: string;
    readonly body: unknown;
  }>,
  addresses: {} as Record<string, string>,
  refuseLinkOn: null as string | null,
}));

vi.mock("../upstream/machines", () => ({
  isLoopbackAddress: (url: string) => new URL(url).hostname === "127.0.0.1",
  machineAddressOf: (environmentId: string) => ({ url: calls.addresses[environmentId]! }),
  callMachine: async (environmentId: string, path: string, body: unknown) => {
    calls.made.push({ environmentId, path, body });
    if (path.endsWith("/invite"))
      return { ok: true, status: 200, body: { environmentId, token: `token-of-${environmentId}` } };
    if (path.endsWith("/link") && calls.refuseLinkOn === environmentId)
      return { ok: true, status: 502, body: { error: "This machine couldn't reach it." } };
    return { ok: true, status: 200, body: {} };
  },
}));

const setup = (addresses: Record<string, string>, refuseLinkOn: string | null = null) => {
  calls.made.length = 0;
  calls.addresses = addresses;
  calls.refuseLinkOn = refuseLinkOn;
};

const here = { environmentId: "here" as EnvironmentId, label: "Laptop" };
const there = { environmentId: "there" as EnvironmentId, label: "Studio Mac" };
const linkOf = (environmentId: string) =>
  calls.made.find((call) => call.environmentId === environmentId && call.path.endsWith("/link"))
    ?.body as { readonly baseUrl: string; readonly token: string } | undefined;

describe("linking this machine with another", () => {
  it("gives each the other's token, and the other this machine's address on the network", async () => {
    setup({ here: "http://127.0.0.1:3773", there: "http://studio.tail.example:3773" });
    expect(await linkMachines(here, there, "http://laptop.tail.example:3773")).toBeNull();
    expect(linkOf("here")).toEqual(
      expect.objectContaining({
        baseUrl: "http://studio.tail.example:3773",
        token: "token-of-there",
      }),
    );
    expect(linkOf("there")).toEqual(
      expect.objectContaining({
        baseUrl: "http://laptop.tail.example:3773",
        token: "token-of-here",
      }),
    );
  });

  it("gives a machine on this device this one's own loopback address", async () => {
    setup({ here: "http://127.0.0.1:3773", there: "http://127.0.0.1:4100" });
    expect(await linkMachines(here, there, null)).toBeNull();
    expect(linkOf("there")?.baseUrl).toBe("http://127.0.0.1:3773");
  });

  it("asks for network access when the other machine has no way to reach this one", async () => {
    setup({ here: "http://127.0.0.1:3773", there: "http://studio.tail.example:3773" });
    expect(await linkMachines(here, there, null)).toContain("Settings › Sharing & access");
    expect(calls.made).toEqual([]);
  });

  it("undoes both sides when either can't keep the link", async () => {
    setup({ here: "http://127.0.0.1:3773", there: "http://studio.tail.example:3773" }, "there");
    expect(await linkMachines(here, there, "http://laptop.tail.example:3773")).toBe(
      "This machine couldn't reach it.",
    );
    expect(
      calls.made.filter((call) => call.path.endsWith("/unlink")).map((call) => call.environmentId),
    ).toEqual(["here", "there"]);
  });
});
