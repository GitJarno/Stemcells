// @effect-diagnostics nodeBuiltinImport:off - runs the command line as node runs it, and reads what it writes.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeZlib from "node:zlib";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { contrast, FRAMES, KEYLINE, keylined } from "../keyline.ts";
import { PACK_FILES, paletteOf } from "../kit.ts";
import { check } from "./check.ts";
import { apng, png } from "./png.ts";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** A PNG's chunks by type, in order. */
function chunks(bytes: Uint8Array): { type: string; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: { type: string; data: Uint8Array }[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = view.getUint32(at);
    const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
    out.push({ type, data: bytes.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return out;
}

describe("the pictures the tools write", () => {
  it("a PNG holds its pixels, row by row", () => {
    const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 9, 9, 9, 255]);
    const bytes = png(2, 2, pixels);
    expect([...bytes.subarray(0, 8)]).toEqual(SIGNATURE);
    const parts = chunks(bytes);
    expect(parts.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const raw = NodeZlib.inflateSync(parts[1]!.data);
    expect([...raw]).toEqual([0, ...pixels.subarray(0, 8), 0, ...pixels.subarray(8)]);
  });

  it("an animated PNG holds every frame and loops", () => {
    const frame = (v: number) => new Uint8Array(4).fill(v);
    const parts = chunks(apng(1, 1, [frame(1), frame(2), frame(3)], 250));
    expect(parts.filter((c) => c.type === "fcTL")).toHaveLength(3);
    expect(parts.filter((c) => c.type === "fdAT")).toHaveLength(2);
    const control = parts.find((c) => c.type === "acTL")!.data;
    expect([...control]).toEqual([0, 0, 0, 3, 0, 0, 0, 0]);
  });
});

describe("the light frame's keyline", () => {
  const palette = paletteOf("claude");

  it("measures contrast as WCAG does", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast(FRAMES.light, FRAMES.light)).toBe(1);
  });

  it("rings a pale piece where it meets the void, never the body or a deep piece", () => {
    const rows = ["....", ".W..", ".BZ.", "...."];
    const lined = keylined(rows, palette);
    expect(lined[0]).toBe(`.${KEYLINE}..`);
    expect(lined[1]).toBe(`${KEYLINE}W${KEYLINE}.`);
    expect(lined[2]).toBe(".BZ.");
    expect(lined[3]).toBe("....");
  });
});

describe("cells, the command line", () => {
  const out = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "cells-test-"));
  afterAll(() => NodeFS.rmSync(out, { recursive: true, force: true }));
  const cells = (...args: string[]) =>
    NodeChildProcess.spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        NodePath.join(import.meta.dirname, "cells.ts"),
        ...args,
        "--out",
        out,
      ],
      { encoding: "utf8" },
    );

  // A test per command: each starts node on the TypeScript, seconds apiece on a CI runner.
  it("runs in plain node: renders a look's sheet and animations", () => {
    const render = cells("render", "house/duck", "idle");
    expect(render.status, render.stderr).toBe(0);
    const sheet = NodeFS.readFileSync(NodePath.join(out, "house_duck", "sheet.png"));
    expect([...sheet.subarray(0, 8)]).toEqual(SIGNATURE);
    const animated = NodeFS.readFileSync(NodePath.join(out, "house_duck", "idle.mini.light.apng"));
    expect(chunks(animated).some((c) => c.type === "acTL")).toBe(true);
  });

  it("runs in plain node: checks a pack", () => {
    const check = cells("check", "house");
    expect(check.status, check.stdout).toBe(0);
  });

  it("runs in plain node: lays out a lookbook", () => {
    expect(cells("lookbook", "house").status).toBe(0);
    expect(NodeFS.readFileSync(NodePath.join(out, "lookbook.html"), "utf8")).toContain(
      "house/duck",
    );
  });

  // The whole library's gate, `cells check`, a drawn pack at a time, so the library grows
  // without one test holding every pack. A pack takes a second or a few on a Mac and up to
  // 20 s on a CI runner: it draws and checks every frame of every look.
  // oxlint-disable-next-line t3code/no-test-timeout-or-unreasoned-skip -- CPU-bound check of every frame a pack draws, not a hidden wait.
  it.each([...PACK_FILES.values()].map((pack) => pack.theme))(
    "the drawn pack %s passes cells check, the library's art gate",
    (theme) => {
      const failures = check({ themes: [theme] }).filter((finding) => finding.level === "fail");
      expect(failures).toEqual([]);
    },
    60_000,
  );

  it("refuses a look it doesn't know", () => {
    const render = cells("render", "house/nothing");
    expect(render.status).toBe(2);
    expect(render.stderr).toContain("no piece house/nothing");
  });
});
