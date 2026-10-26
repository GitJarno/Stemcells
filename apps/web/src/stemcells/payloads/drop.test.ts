/**
 * How a carry dropped on a chat is read into the Files its composer takes: the bytes the window
 * holds as they are, a machine's file signed afresh (the address a chat showed it by expires), a
 * page's or the web's address, and the refusals a person is told. Each case names what it keeps
 * from going wrong.
 */
import { describe, expect, it, vi } from "vite-plus/test";

import { startCarry } from "./carry";
import { filesOf, makeCarryDropHandlers, type Reading } from "./drop";
import { IMPORT_PATH } from "./land";
import { overCap, type Shown } from "./payload";
import { CARRIED_TYPE, encodeCarried, type Carried } from "./wire";

const MB = 1024 * 1024;

const item = (over: Partial<Shown>): Shown => ({
  name: "sky.png",
  kind: "image",
  mimeType: "image/png",
  sizeBytes: null,
  asset: null,
  url: null,
  ...over,
});

const carry = (...items: Shown[]): Carried => ({ version: 1, drag: "drag-1", items });

/** The app's reading, kept: what was signed, fetched and asked of the primary's server. */
function reading(
  more: {
    readonly answers?: Readonly<Record<string, () => Response>>;
    readonly primary?: string | null;
    readonly unsigned?: boolean;
  } = {},
) {
  const kept = { signed: [] as string[], fetched: [] as string[], posted: [] as unknown[] };
  const answer = (url: string) => {
    const make = more.answers?.[url];
    if (make === undefined) throw new TypeError("Failed to fetch");
    return make();
  };
  const it: Reading = {
    signedAsset: async (environmentId, resource) => {
      kept.signed.push(
        `${environmentId}:${"attachmentId" in resource ? resource.attachmentId : ""}`,
      );
      return more.unsigned
        ? null
        : { issued: "/api/assets/fresh", whole: `http://${environmentId}/api/assets/fresh` };
    },
    fetch: async (url) => {
      kept.fetched.push(url);
      return answer(url);
    },
    postToPrimary: async (pathname, body) => {
      kept.posted.push({ pathname, body });
      return answer(`primary:${pathname}`);
    },
    primary: () => (more.primary === undefined ? "machine-here" : more.primary),
    isPictureType: (mimeType) => mimeType.startsWith("image/"),
    maxBytes: 50 * MB,
  };
  return { it, kept };
}

const bytes = (text: string, type = "image/png") =>
  new Response(new Blob([text], { type }), { headers: { "content-type": type } });

describe("a carry read into files", () => {
  it("takes the bytes the window holds as they are, read from nowhere", async () => {
    // A chip carried within its window needs no copy of its bytes.
    const held = new File(["png"], "sky.png", { type: "image/png" });
    const { it: hands, kept } = reading();
    const read = await filesOf(carry(item({ url: "blob:lent" })), [held], hands);
    expect(read.files).toEqual([held]);
    expect(read.files[0]).toBe(held);
    expect(kept.fetched).toEqual([]);
  });

  it("names held bytes as the chip did", async () => {
    const held = new File(["png"], "image.png", { type: "image/png" });
    const { it: hands } = reading();
    const read = await filesOf(carry(item({ name: "sky.png" })), [held], hands);
    expect(read.files[0]?.name).toBe("sky.png");
    expect(read.files[0]?.type).toBe("image/png");
  });

  it("asks a machine's file afresh of that machine, so another machine's chat can take it", async () => {
    const pdf = item({
      name: "notes.pdf",
      kind: "file",
      mimeType: "application/pdf",
      asset: {
        environmentId: "machine-there",
        resource: { _tag: "attachment", attachmentId: "thread-1-notes" },
      },
    });
    const { it: hands, kept } = reading({
      answers: { "http://machine-there/api/assets/fresh": () => bytes("%PDF", "application/pdf") },
    });
    const read = await filesOf(carry(pdf), [], hands);
    expect(kept.signed).toEqual(["machine-there:thread-1-notes"]);
    expect(read.refused).toEqual([]);
    expect(read.files.map((file) => [file.name, file.type, file.size])).toEqual([
      ["notes.pdf", "application/pdf", 4],
    ]);
  });

  it("says so when the machine no longer gives the file", async () => {
    const { it: hands } = reading({ unsigned: true });
    const read = await filesOf(
      carry(
        item({
          asset: { environmentId: "m", resource: { _tag: "attachment", attachmentId: "a" } },
        }),
      ),
      [],
      hands,
    );
    expect(read).toEqual({ files: [], refused: [{ name: "sky.png", reason: "No longer there" }] });
  });

  it("refuses a file bigger than any message takes before reading it", async () => {
    const big = new Response("", { headers: { "content-length": String(51 * MB) } });
    const read = vi.spyOn(big, "blob");
    const { it: hands } = reading({ answers: { "https://example.com/big.mp4": () => big } });
    const result = await filesOf(
      carry(
        item({
          name: "big.mp4",
          kind: "video",
          mimeType: "video/mp4",
          url: "https://example.com/big.mp4",
        }),
      ),
      [],
      hands,
    );
    expect(result.refused).toEqual([{ name: "big.mp4", reason: "Over 50 MB" }]);
    expect(read).not.toHaveBeenCalled();
  });

  it("stops reading at the cap when the answer doesn't say its size", async () => {
    // A web address may stream without end, and the page would hold all of it.
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 100) controller.close();
        else controller.enqueue(new Uint8Array(1));
      },
    });
    const { it: hands } = reading({
      answers: { "https://example.com/live.mp4": () => new Response(stream) },
    });
    const result = await filesOf(
      carry(
        item({
          name: "live.mp4",
          kind: "video",
          mimeType: "video/mp4",
          url: "https://example.com/live.mp4",
        }),
      ),
      [],
      { ...hands, maxBytes: 4 },
    );
    expect(result.refused).toEqual([{ name: "live.mp4", reason: overCap(4) }]);
    expect(pulled).toBeLessThan(10);
  });

  it("takes the type the answer declares over the one its name suggests", async () => {
    // A web picture's type is guessed from its address; the server says what it sent.
    const answering = (type: string) =>
      reading({ answers: { "https://example.com/sky.png": () => bytes("img", type) } }).it;
    const typeOf = async (type: string) =>
      (await filesOf(carry(item({ url: "https://example.com/sky.png" })), [], answering(type)))
        .files[0]?.type;
    expect(await typeOf("image/webp")).toBe("image/webp");
    expect(await typeOf("application/octet-stream")).toBe("image/png");
  });

  it("reads another window's lent bytes by their address", async () => {
    const { it: hands } = reading({ answers: { "blob:lent": () => bytes("png") } });
    const read = await filesOf(carry(item({ url: "blob:lent" })), [], hands);
    expect(read.files.map((file) => file.name)).toEqual(["sky.png"]);
  });

  it("refuses a page where the address named a file", async () => {
    const { it: hands } = reading({
      answers: { "https://example.com/sky.png": () => bytes("<html>", "text/html; charset=utf-8") },
    });
    const read = await filesOf(carry(item({ url: "https://example.com/sky.png" })), [], hands);
    expect(read.refused).toEqual([{ name: "sky.png", reason: "Got a web page, not the file" }]);
  });

  it("has the primary's server fetch a web picture the page can't", async () => {
    // Most sites' pictures can't be read by another site's page; the server isn't held to that.
    const { it: hands, kept } = reading({
      answers: { [`primary:${IMPORT_PATH}`]: () => bytes("png") },
    });
    const read = await filesOf(carry(item({ url: "https://example.com/sky.png" })), [], hands);
    expect(kept.posted).toEqual([
      {
        pathname: IMPORT_PATH,
        body: { from: { url: "https://example.com/sky.png" }, as: "picture", name: "sky.png" },
      },
    ]);
    expect(read.files.map((file) => file.name)).toEqual(["sky.png"]);
  });

  it("refuses a web picture the page can't read where no server could fetch it", async () => {
    const { it: hands } = reading({ primary: null });
    const read = await filesOf(carry(item({ url: "https://example.com/sky.png" })), [], hands);
    expect(read.refused).toEqual([{ name: "sky.png", reason: "Can't fetch it here" }]);
  });

  it("reads no address but the page's and the web's", async () => {
    const { it: hands, kept } = reading();
    const read = await filesOf(carry(item({ url: "file:///etc/hosts" })), [], hands);
    expect(read.refused).toEqual([{ name: "sky.png", reason: "Nothing to copy" }]);
    expect(kept.fetched).toEqual([]);
  });

  it("keeps the carry's order, and lists what didn't come with why", async () => {
    const held = new File(["a"], "a.png", { type: "image/png" });
    const { it: hands } = reading({ answers: { "blob:c": () => bytes("c") } });
    const read = await filesOf(
      carry(
        item({ name: "a.png" }),
        item({ name: "b.png", url: "blob:gone" }),
        item({ name: "c.png", url: "blob:c" }),
      ),
      [held, null, null],
      hands,
    );
    expect(read.files.map((file) => file.name)).toEqual(["a.png", "c.png"]);
    expect(read.refused).toEqual([{ name: "b.png", reason: "Couldn't read it" }]);
  });
});

describe("a carry dropped on a chat", () => {
  it("is read only when one of the app's windows started it", () => {
    // A web page can put our type on a drag of its own, naming any address or file.
    const shown = item({ url: "https://example.com/sky.png" });
    const { it: hands, kept } = reading({
      answers: { "https://example.com/sky.png": () => bytes("png") },
    });
    const handlers = makeCarryDropHandlers({ setDragActive: () => {}, addFiles: () => {} }, hands);
    const drop = (raw: string) =>
      handlers.onDrop({
        dataTransfer: { types: [CARRIED_TYPE], getData: () => raw, dropEffect: "none" },
        relatedTarget: null,
        currentTarget: { contains: () => false },
        preventDefault: () => {},
      });

    drop(encodeCarried({ version: 1, drag: "from-a-page", items: [shown] }));
    expect(kept.fetched).toEqual([]);

    const written: Record<string, string> = {};
    startCarry(
      {
        dataTransfer: {
          clearData: () => {},
          setData: (type, data) => {
            written[type] = data;
          },
          effectAllowed: "none",
        },
        currentTarget: new EventTarget(),
      },
      { items: [shown] },
    );
    drop(written[CARRIED_TYPE]!);
    expect(kept.fetched).toEqual(["https://example.com/sky.png"]);
  });
});
