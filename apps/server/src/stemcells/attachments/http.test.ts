// @effect-diagnostics nodeBuiltinImport:off - the test serves real files from its own web server.
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { expect, it } from "@effect/vitest";
import { afterAll, beforeAll } from "vite-plus/test";
import { makeImportRoute } from "../upstream/attachments.fixture.ts";
import { publicAddresses } from "../upstream/attachments.ts";
import * as AttachmentsHttp from "./http.ts";
import type { Resolve } from "./import.ts";

// The import route over HTTP: only a caller allowed to operate this
// environment brings files in, and what it brings is a pending attachment
// of its own in this server's store.

const baseDir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-carry-route-"));
const shown = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-carry-shown-"));
/** The video a chat showed, which the route brings in by its signed URL. */
const shownFile = NodePath.join(shown, "recording.mp4");
NodeFS.writeFileSync(shownFile, "a video");
const { signedIn } = makeImportRoute({ baseDir, workspaceRoot: shown, shownFile });

/** This test's own web server, let through the public check every web import makes. */
const testServerToo: Resolve = async (host) =>
  host === "127.0.0.1" ? [{ address: "127.0.0.1", family: 4 }] : publicAddresses(host);
const limits = (more: Partial<AttachmentsHttp.Limits> = {}): AttachmentsHttp.Limits => ({
  ...AttachmentsHttp.LIMITS,
  resolve: testServerToo,
  ...more,
});

const seen: string[] = [];
const closed: string[] = [];
let server: NodeHttp.Server;
let web = "";
beforeAll(async () => {
  server = NodeHttp.createServer((request, response) => {
    seen.push(request.url ?? "");
    response.on("close", () => closed.push(request.url ?? ""));
    if (request.url === "/clips/stall.mp4") {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.write(Buffer.alloc(100));
    } else if (request.url === "/pictures/sky.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(Buffer.from("png bytes"));
    } else if (request.url === "/clips/rain.mp4") {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.end(Buffer.from("mp4 bytes"));
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  web = `http://127.0.0.1:${(server.address() as NodeNet.AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const dir of [baseDir, shown]) NodeFS.rmSync(dir, { recursive: true, force: true });
});

const refusalOf = async (answer: Response) => ({
  status: answer.status,
  ...((await answer.json()) as { reason: string }),
});

it.live("brings files in only for a caller allowed to operate, each as its own attachment", () =>
  signedIn(limits(), async ({ bring, signedIn, asset, attachmentsDir }) => {
    expect((await bring({ from: { asset } })).status).toBe(401);
    // Another site can't ride the person's session to write a file here.
    const cookie = { origin: "https://elsewhere.example" };
    expect((await signedIn({ from: { asset } }, { headers: cookie })).status).toBe(401);

    // A file a chat showed: twice, two attachments of their own.
    const first = await signedIn({ from: { asset } });
    expect(first.status).toBe(200);
    const one = (await first.json()) as { attachmentId: string };
    expect(one).toMatchObject({ name: "recording.mp4", mimeType: "video/mp4", sizeBytes: 7 });
    const two = (await (await signedIn({ from: { asset } })).json()) as { attachmentId: string };
    expect(two.attachmentId).not.toBe(one.attachmentId);
    for (const { attachmentId } of [one, two]) {
      expect(attachmentId).toMatch(/^pending-.*-mp4$/);
      expect(
        NodeFS.readFileSync(NodePath.join(attachmentsDir, `${attachmentId}.mp4`), "utf8"),
      ).toBe("a video");
    }

    // A web address: stored once, or a picture's bytes answered.
    const clip = await signedIn({ from: { url: `${web}/clips/rain.mp4` } });
    expect(await clip.json()).toMatchObject({ name: "rain.mp4", sizeBytes: 9 });
    const sky = await signedIn({ from: { url: `${web}/pictures/sky.png` }, as: "picture" });
    expect(sky.status).toBe(200);
    expect(sky.headers.get("content-type")).toBe("image/png");
    expect(sky.headers.get("x-stemcells-name")).toBe("sky.png");
    expect(await sky.text()).toBe("png bytes");

    // Refusals say why, in a few words.
    expect(await refusalOf(await signedIn({ from: { asset: `${asset}x` } }))).toEqual({
      status: 404,
      reason: "No longer there",
    });
    expect(
      await refusalOf(await signedIn({ from: { url: `${web}/clips/rain.mp4` }, as: "picture" })),
    ).toEqual({ status: 415, reason: "Not a PNG, JPEG, GIF or WebP" });
    expect(await refusalOf(await signedIn({ from: { path: "/etc/hosts" } }))).toEqual({
      status: 400,
      reason: "Not understood",
    });
  }),
);

it.live("refuses a request too large to read, and never reads one that says it is", () =>
  signedIn(limits(), async ({ signedIn }) => {
    const tooLarge = { status: 413, reason: "Too large to read" };
    // One that declares gigabytes is answered before a byte of it is taken.
    let pulled = 0;
    const flood = new ReadableStream<Uint8Array>(
      {
        pull: (controller) => {
          if (pulled > AttachmentsHttp.IMPORT_BODY_MOST) return controller.close();
          pulled += 64 * 1024;
          controller.enqueue(new Uint8Array(64 * 1024));
        },
      },
      { highWaterMark: 0 },
    );
    const declared = await signedIn(flood, {
      headers: { "content-length": String(8 * 1024 ** 3) },
    });
    expect(await refusalOf(declared)).toEqual(tooLarge);
    expect(pulled).toBe(0);
    // One that declares nothing is measured as it's read (`http/body.test.ts`
    // shows the reader stopping at the bound).
    const fetched = seen.length;
    const padded = JSON.stringify({
      from: { url: `${web}/clips/rain.mp4` },
      name: "x".repeat(AttachmentsHttp.IMPORT_BODY_MOST),
    });
    expect(await refusalOf(await signedIn(padded))).toEqual(tooLarge);
    expect(seen.length).toBe(fetched);
  }),
);

it.live("never fetches this machine's own addresses, whatever the route is asked", () =>
  signedIn(AttachmentsHttp.LIMITS, async ({ signedIn }) => {
    const before = seen.length;
    expect(await refusalOf(await signedIn({ from: { url: `${web}/clips/rain.mp4` } }))).toEqual({
      status: 502,
      reason: "Couldn't fetch it",
    });
    expect(seen.length).toBe(before);
  }),
);

it.live("runs a few imports at once, and one whose caller went away stops, leaving nothing", () =>
  signedIn(limits({ imports: 1 }), async ({ signedIn, attachmentsDir }) => {
    const away = new AbortController();
    const stalled = signedIn({ from: { url: `${web}/clips/stall.mp4` } }, { signal: away.signal });
    await expect.poll(() => seen.includes("/clips/stall.mp4")).toBe(true);
    expect(await refusalOf(await signedIn({ from: { url: `${web}/clips/rain.mp4` } }))).toEqual({
      status: 503,
      reason: "Busy, try again",
    });
    away.abort();
    await stalled.catch(() => null);
    await expect.poll(() => closed.includes("/clips/stall.mp4")).toBe(true);
    await expect
      .poll(() => NodeFS.readdirSync(attachmentsDir).some((entry) => entry.endsWith(".part")))
      .toBe(false);
    // Its place is given back.
    expect((await signedIn({ from: { url: `${web}/clips/rain.mp4` } })).status).toBe(200);
  }),
);

it.live("keeps the bytes waiting unsent under a ceiling", () =>
  signedIn(limits({ pendingBytes: 10 }), async ({ signedIn, asset, attachmentsDir }) => {
    for (const entry of NodeFS.readdirSync(attachmentsDir))
      NodeFS.rmSync(NodePath.join(attachmentsDir, entry), { force: true });
    expect((await signedIn({ from: { asset } })).status).toBe(200);
    expect(await refusalOf(await signedIn({ from: { asset } }))).toEqual({
      status: 507,
      reason: "Too many files waiting to send",
    });
  }),
);
