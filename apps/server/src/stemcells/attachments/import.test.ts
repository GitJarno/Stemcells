// @effect-diagnostics nodeBuiltinImport:off - real files and a real local web server.
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeStream from "node:stream";
import * as NodeTimersPromises from "node:timers/promises";
import * as NodeZlib from "node:zlib";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { publicAddresses } from "../upstream/attachments.ts";
import {
  cleanName,
  fromAddress,
  readPicture,
  store,
  type Incoming,
  type Resolve,
} from "./import.ts";

const dirs: string[] = [];
const freshDir = () => {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-import-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

const bytes = (count: number, fill = 7) => Buffer.alloc(count, fill);
const incoming = (body: Buffer, more: Partial<Incoming> = {}): Incoming => ({
  name: "clip.mp4",
  mimeType: "video/mp4",
  size: body.byteLength,
  open: () => NodeStream.Readable.from([body]),
  discard: () => {},
  ...more,
});

/** Every request the web server below took, and the responses that closed. */
const seen: string[] = [];
const closed: string[] = [];
let server: NodeHttp.Server;
let port = 0;
let base = "";
beforeAll(async () => {
  server = NodeHttp.createServer((request, response) => {
    const url = request.url ?? "";
    seen.push(url);
    response.on("close", () => closed.push(url));
    if (url === "/shots/one.png") {
      response.writeHead(200, { "content-type": "image/png", "content-length": "16" });
      response.end(bytes(16));
    } else if (url === "/moved.png") {
      response.writeHead(302, { location: "/shots/one.png" });
      response.end();
    } else if (url === "/to-metadata") {
      response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      response.end();
    } else if (url === "/to-localhost") {
      response.writeHead(307, { location: `http://localhost:${port}/shots/one.png` });
      response.end();
    } else if (url === "/loop") {
      response.writeHead(302, { location: "/loop" });
      response.end();
    } else if (url === "/huge.mp4") {
      response.writeHead(200, { "content-type": "video/mp4", "content-length": String(10_000) });
      response.end(bytes(10_000));
    } else if (url === "/endless.png") {
      // No length said, sent in chunks: the cap is found by counting.
      response.writeHead(200, { "content-type": "image/png" });
      for (let chunk = 0; chunk < 10; chunk += 1) response.write(bytes(1_000));
      response.end();
    } else if (url === "/endless-stall.png") {
      // Over the cap in chunks, then nothing more: what's left must be hung up on, not left to time out.
      response.writeHead(200, { "content-type": "image/png" });
      for (let chunk = 0; chunk < 10; chunk += 1) response.write(bytes(1_000));
    } else if (url === "/bomb.png") {
      // Small on the wire, big once inflated: counted as it inflates.
      const packed = NodeZlib.gzipSync(bytes(10_000));
      response.writeHead(200, {
        "content-type": "image/png",
        "content-encoding": "gzip",
        "content-length": String(packed.byteLength),
      });
      response.end(packed);
    } else if (url === "/reset.png") {
      response.writeHead(200, { "content-type": "image/png", "content-length": "1000" });
      response.write(bytes(100), () => request.socket.destroy());
    } else if (url === "/stall.png" || url === "/stall.mp4" || url === "/stall.svg") {
      const type = url.endsWith(".svg")
        ? "image/svg+xml"
        : url.endsWith(".png")
          ? "image/png"
          : "video/mp4";
      response.writeHead(200, { "content-type": type });
      response.write(bytes(100));
    } else if (url === "/page.svg") {
      response.writeHead(200, { "content-type": "image/svg+xml" });
      response.end("<svg/>");
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as NodeNet.AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const LOOPBACK = [{ address: "127.0.0.1", family: 4 }];
/** Upstream's public check, letting this test's own server (and a made-up name for it) through. */
const testServerToo: Resolve = async (host) =>
  host === "127.0.0.1" || host === "pinned.example" ? LOOPBACK : publicAddresses(host);
const through = { resolve: testServerToo };

const waitFor = async (check: () => boolean) => {
  for (let tries = 0; tries < 100 && !check(); tries += 1) await NodeTimersPromises.setTimeout(20);
  return check();
};
const UNFETCHED = { ok: false, status: 502, reason: "Couldn't fetch it" };

describe("a file brought into a chat", () => {
  it("is copied into its own pending attachment, leaving no part file", async () => {
    const dir = freshDir();
    const path = NodePath.join(dir, "pending-1-mp4.mp4");
    const result = await store(incoming(bytes(64)), { attachmentId: "pending-1-mp4", path }, 1024);
    expect(result).toEqual({
      ok: true,
      attachmentId: "pending-1-mp4",
      name: "clip.mp4",
      mimeType: "video/mp4",
      sizeBytes: 64,
    });
    expect(NodeFS.readFileSync(path)).toEqual(bytes(64));
    expect(NodeFS.readdirSync(dir)).toEqual(["pending-1-mp4.mp4"]);
  });

  it("over the cap is refused, keeping nothing, whether its size was said or counted", async () => {
    const dir = freshDir();
    const path = NodePath.join(dir, "pending-2-mp4.mp4");
    const to = { attachmentId: "pending-2-mp4", path };
    const MB = 1024 * 1024;
    expect(await store(incoming(bytes(10)), to, 5)).toMatchObject({ ok: false, status: 413 });
    expect(await store(incoming(bytes(2 * MB), { size: null }), to, MB)).toEqual({
      ok: false,
      status: 413,
      reason: "Over 1 MB",
    });
    expect(NodeFS.readdirSync(dir)).toEqual([]);
  });

  it("stops when its caller goes away, leaving nothing and hanging up on the web", async () => {
    const dir = freshDir();
    const abort = new AbortController();
    const stalled = await fromAddress(`${base}/stall.mp4`, 10_000, through);
    if ("ok" in stalled) throw new Error(stalled.reason);
    const path = NodePath.join(dir, "pending-3-mp4.mp4");
    const storing = store(stalled, { attachmentId: "pending-3-mp4", path }, 10_000, abort.signal);
    await waitFor(() => NodeFS.readdirSync(dir).some((entry) => entry.endsWith(".part")));
    abort.abort();
    expect(await storing).toMatchObject({ ok: false });
    expect(NodeFS.readdirSync(dir)).toEqual([]);
    expect(await waitFor(() => closed.includes("/stall.mp4"))).toBe(true);
  });
});

describe("a web address brought in", () => {
  it("is fetched once into the store, following a redirect, named by where it ended up", async () => {
    const dir = freshDir();
    const fetched = await fromAddress(`${base}/moved.png`, 1024, through);
    if ("ok" in fetched) throw new Error(fetched.reason);
    expect(fetched).toMatchObject({ name: "one.png", mimeType: "image/png", size: 16 });
    const path = NodePath.join(dir, "pending-4-png.png");
    expect(await store(fetched, { attachmentId: "pending-4-png", path }, 1024)).toMatchObject({
      ok: true,
      sizeBytes: 16,
    });
  });

  it("connects only to the address its name was checked as (no second lookup to rebind)", async () => {
    // `pinned.example` exists nowhere but the check: reaching the server proves the connection used it.
    const fetched = await fromAddress(`http://pinned.example:${port}/shots/one.png`, 1024, through);
    expect(fetched).toMatchObject({ name: "one.png", size: 16 });
    if (!("ok" in fetched)) fetched.discard();
  });

  it("is never this machine, its network or a metadata address, by address or by name", async () => {
    const before = seen.length;
    for (const address of [
      `${base}/shots/one.png`,
      `http://localhost:${port}/shots/one.png`,
      `http://[::1]:${port}/shots/one.png`,
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.1/",
      "http://10.0.0.1/",
    ])
      expect(await fromAddress(address, 1024)).toEqual(UNFETCHED);
    expect(seen.length).toBe(before);
  });

  it("re-checks every redirect, and gives up after five", async () => {
    expect(await fromAddress(`${base}/to-metadata`, 1024, through)).toEqual(UNFETCHED);
    const before = seen.filter((url) => url === "/shots/one.png").length;
    expect(await fromAddress(`${base}/to-localhost`, 1024, through)).toEqual(UNFETCHED);
    expect(seen.filter((url) => url === "/shots/one.png").length).toBe(before);
    const loops = seen.filter((url) => url === "/loop").length;
    expect(await fromAddress(`${base}/loop`, 1024, through)).toEqual(UNFETCHED);
    expect(seen.filter((url) => url === "/loop").length - loops).toBe(6);
  });

  it("answers the same whether refused, missing or unreachable, so it scans nothing", async () => {
    expect(await fromAddress(`${base}/missing.png`, 1024, through)).toEqual(UNFETCHED);
    const closedPort = NodeHttp.createServer();
    await new Promise<void>((resolve) => closedPort.listen(0, "127.0.0.1", resolve));
    const free = (closedPort.address() as NodeNet.AddressInfo).port;
    await new Promise<void>((resolve) => closedPort.close(() => resolve()));
    expect(await fromAddress(`http://127.0.0.1:${free}/`, 1024, through)).toEqual(UNFETCHED);
  });

  it("isn't read when it says it is over the cap", async () => {
    expect(await fromAddress(`${base}/huge.mp4`, 1000, through)).toEqual({
      ok: false,
      status: 413,
      reason: "Over 0 MB",
    });
  });

  it("must be a web address", async () => {
    expect(await fromAddress("file:///etc/hosts", 1000)).toMatchObject({ ok: false, status: 400 });
    expect(await fromAddress("not an address", 1000)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("a picture from the web", () => {
  const picture = async (path: string, cap = 1024, timeoutMs?: number) => {
    const fetched = await fromAddress(`${base}${path}`, cap, {
      ...through,
      ...(timeoutMs ? { timeoutMs } : {}),
    });
    return "ok" in fetched ? fetched : readPicture(fetched, cap);
  };

  it("is only one of the types a model is sent, and the rest of a refused one isn't waited for", async () => {
    expect(await picture("/shots/one.png")).toMatchObject({ ok: true, mimeType: "image/png" });
    expect(await picture("/page.svg")).toMatchObject({ ok: false, status: 415 });
    expect(await picture("/stall.svg")).toMatchObject({ ok: false, status: 415 });
    expect(await waitFor(() => closed.includes("/stall.svg"))).toBe(true);
  });

  it("over the cap in chunks or once inflated is refused, and the server stays up", async () => {
    expect(await picture("/endless.png", 5_000)).toMatchObject({ ok: false, status: 413 });
    expect(await picture("/bomb.png", 5_000)).toMatchObject({ ok: false, status: 413 });
    expect(await picture("/endless-stall.png", 5_000, 300)).toMatchObject({
      ok: false,
      status: 413,
    });
    expect(await waitFor(() => closed.includes("/endless-stall.png"))).toBe(true);
    // Past its timeout: a body left unread would fail now, with no one listening.
    await NodeTimersPromises.setTimeout(400);
  });

  it("cut off midway, or too slow, is refused, and the server stays up", async () => {
    expect(await picture("/reset.png")).toEqual(UNFETCHED);
    expect(await picture("/stall.png", 1024, 200)).toEqual(UNFETCHED);
  });
});

describe("a name kept", () => {
  it("is the last part of what was given, without control characters", () => {
    expect(cleanName("../../etc/passwd")).toBe("passwd");
    expect(cleanName("C:\\Users\\example\\clip.mp4")).toBe("clip.mp4");
    expect(cleanName("bad\u0000name.png")).toBe("badname.png");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(undefined)).toBeNull();
  });
});
