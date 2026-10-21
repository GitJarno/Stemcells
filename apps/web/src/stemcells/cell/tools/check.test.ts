import { describe, expect, it, vi } from "vite-plus/test";

import { DRAWN_SCENES, PACK_OUTFITS, pieceOf, REST, SCENES, TEMPERAMENTS } from "../kit.ts";
import { curated, outfitLook, packLook, probeStill, sceneOf } from "../scene.ts";
import { check, type Finding } from "./check.ts";

/**
 * Art drawn the way a pack agent draws it, read through the same loader the
 * app uses (`art.ts`): one pack that keeps every rule, one that breaks each,
 * a move set and two temperaments.
 */
vi.mock("../art.ts", () => {
  const blank = (n: number, width: number) => Array.from({ length: n }, () => ".".repeat(width));
  const piece = (fields: Record<string, unknown>) => fields;
  return {
    ART_PACKS: {
      house: { theme: "house", season: null, pieces: [] },
      misnamed: { theme: "elsewhere", season: null, pieces: [] },
      trial: {
        theme: "trial",
        season: null,
        about: "A pack that keeps every rule.",
        pieces: [
          piece({
            name: "cap",
            slot: "headwear",
            art: ["YYYYYYYY", "YYYYYYYY", "YYYYYYYY"],
            hotspot: [4, 2],
            mini: ["YYYY", "YYYY"],
            miniHotspot: [2, 1],
          }),
          piece({
            name: "hem",
            slot: "back",
            art: ["QQQQQQQQQQQQQQQQQQQQQQQQQQ"],
            hotspot: [13, 0],
            mini: ["QQQQQQQQQ"],
            miniHotspot: [4, 4],
          }),
          piece({
            // Wide enough that a lean pushes it off the canvas: it is worn only in the wave.
            name: "hem-up",
            slot: "back",
            posed: true,
            art: ["NNNNNNNNNNNNNNNNNNNNNNNNNNNNNN"],
            hotspot: [15, 0],
            mini: ["NNNNNNNNNNNNN"],
            miniHotspot: [6, 4],
          }),
          piece({
            name: "mask",
            slot: "face",
            eyes: true,
            poses: { building: "mask-down" },
            art: ["SSSSSSSSSSSSSS"],
            hotspot: [7, 4],
            mini: ["SSSSSSS"],
            miniHotspot: [3, 2],
          }),
          piece({
            name: "mask-down",
            slot: "face",
            eyes: true,
            posed: true,
            art: ["SSSSSSSSSSSSSS", "SSSSSSSSSSSSSS", "SSSSSSSSSSSSSS", "SSSSSSSSSSSSSS"],
            hotspot: [7, 2],
            mini: ["SSSSSSS", "SSSSSSS", "SSSSSSS"],
            miniHotspot: [3, 1],
          }),
        ],
        fabrics: {
          denim: [
            {
              parts: ["torso"],
              map: { B: "1", b: "2" },
              rides: false,
              rows: [26, 29],
              miniRows: [11, 13],
            },
          ],
          "denim-rose": {
            about: "Rose denim from the waist down.",
            bands: [
              {
                parts: ["torso"],
                map: { B: "I", b: "i" },
                rides: false,
                rows: [26, 29],
                miniRows: [11, 13],
              },
            ],
          },
        },
        outfits: [
          {
            id: "worker",
            headwear: "trial/cap",
            back: "trial/hem",
            fabric: "trial/denim",
            colourways: [{ id: "rose", fabric: "trial/denim-rose" }],
            cheer: "trial/wave",
            silhouette: "cap",
            family: "blue",
          },
          { id: "masked", face: "trial/mask", silhouette: "mask", family: "sky" },
          {
            id: "rogue",
            back: "trial/hem",
            cheer: "trial/vanish",
            silhouette: "hem",
            family: "grey",
          },
          {
            id: "knight",
            headwear: "helm",
            outfit: "plate",
            cheer: "knight",
            silhouette: "helm",
            family: "steel",
          },
        ],
        cheers: {
          wave: {
            fps: 6,
            facing: "right",
            kind: "once",
            tell: 1,
            frames: [
              { pose: { eyes: "happy" } },
              { pose: { eyes: "happy", base: 28 }, swaps: { "trial/hem": "trial/hem-up" } },
            ],
          },
          vanish: {
            fps: 6,
            facing: "right",
            kind: "once",
            tell: 1,
            frames: [
              { pose: {} },
              {
                pose: {},
                hidden: true,
                layers: [{ art: ["!!!"], attach: "ground", hotspot: [1, 1], z: 5 }],
              },
            ],
          },
        },
      },
      faulty: {
        theme: "faulty",
        season: { from: "13-01", to: "02-14" },
        pieces: [
          piece({
            name: "spire",
            slot: "headwear",
            art: Array.from({ length: 21 }, () => "YY"),
            hotspot: [1, 20],
            mini: Array.from({ length: 10 }, () => "Y"),
            miniHotspot: [0, 9],
          }),
          piece({
            name: "visor",
            slot: "face",
            art: ["SSSSSSSSSSSSSS", "SSSSSSSSSSSSSS", "SSSSSSSSSSSSSS", "SSSSSSSSSSSSSS"],
            hotspot: [7, 2],
            mini: ["SSSSSSS", "SSSSSSS", "SSSSSSS"],
            miniHotspot: [3, 1],
          }),
          piece({
            name: "soot",
            slot: "headwear",
            art: ["______", "______"],
            hotspot: [3, 1],
            mini: ["___"],
            miniHotspot: [1, 0],
          }),
          piece({
            name: "beard",
            slot: "headwear",
            art: [...blank(9, 5), "ZZZZZ", "ZZZZZ", "ZZZZZ"],
            hotspot: [2, 0],
            mini: ["...", "...", "...", "ZZZ", "ZZZ"],
            miniHotspot: [1, 0],
          }),
          piece({
            name: "flicker",
            slot: "headwear",
            art: ["YY"],
            hotspot: [1, 1],
            mini: ["Y"],
            miniHotspot: [0, 0],
            frames: [["YY"], ["SS"]],
            miniFrames: [["Y"], ["S"]],
            fps: 5,
          }),
          piece({
            name: "smudge",
            slot: "headwear",
            art: ["%%"],
            hotspot: [1, 1],
            mini: ["%"],
            miniHotspot: [0, 0],
          }),
          piece({
            name: "turn",
            slot: "headwear",
            art: ["YY"],
            hotspot: [1, 1],
            mini: ["Y"],
            miniHotspot: [0, 0],
            poses: { idle: "nothing" },
          }),
        ],
        outfits: [
          { id: "one", headwear: "faulty/visor", silhouette: "hat", family: "red" },
          { id: "two", headwear: "faulty/turn", silhouette: "hat", family: "red" },
        ],
      },
    },
    ART_MOVES: {
      trial: {
        scenes: {
          idle: { fps: 1, facing: "right", tell: 0, frames: [{ pose: { eyes: "wide" } }] },
          "trial/0": {
            fps: 6,
            facing: "right",
            kind: "loop",
            tell: 1,
            next: "idle",
            frames: [
              { pose: {} },
              {
                pose: { eyes: "happy" },
                layers: [{ art: ["!"], attach: "headTop", hotspot: [0, 2], z: 5 }],
              },
            ],
          },
          "trial/1": {
            fps: 5,
            facing: "right",
            next: "nowhere",
            frames: [{ pose: {} }, { pose: {} }],
          },
        },
        meta: { idle: { tell: 0, kind: "loop" } },
      },
    },
    ART_TEMPERAMENTS: {
      steady: {
        id: "steady",
        weight: 2,
        breath: { periodMs: 4200, depthRows: 1 },
        blink: { windowMs: 4000, shutMs: 150, double: false },
        noticeMs: 300,
        gaze: [{ look: [1, 0], holdMs: 1200 }],
        fidget: "idle",
        beats: {
          onIt: "idle",
          landed: "happy",
          needsYou: "waiting",
          wake: "idle",
          sleep: "asleep",
        },
      },
      jumpy: {
        id: "jumpy",
        weight: 0,
        breath: { periodMs: 2000, depthRows: 1 },
        blink: { windowMs: 2000, shutMs: 120, double: true },
        noticeMs: 0,
        gaze: [],
        fidget: "nope",
        beats: {
          onIt: "idle",
          landed: "happy",
          needsYou: "waiting",
          wake: "idle",
          sleep: "asleep",
        },
      },
    },
  };
});

const findings = check({ themes: ["trial", "faulty"] });
const about = (subject: string): Finding[] =>
  findings.filter((f) => f.subject === subject || f.subject.endsWith(`: ${subject}`));
const rules = (subject: string, level = "fail") =>
  [
    ...new Set(
      about(subject)
        .filter((f) => f.level === level)
        .map((f) => f.rule),
    ),
  ].sort();

describe("art drawn beside the kit", () => {
  it("joins the kit: a pack's outfits, the move set's scenes and meta, the temperaments", () => {
    expect(PACK_OUTFITS.get("trial/worker")?.colourways).toEqual([
      { id: "rose", fabric: "trial/denim-rose" },
    ]);
    expect(DRAWN_SCENES.get("trial/0")?.meta).toEqual({ kind: "loop", tell: 1, next: "idle" });
    expect(SCENES.get("idle")?.meta).toEqual({ tell: 0, kind: "loop" });
    expect([...TEMPERAMENTS.keys()].toSorted()).toEqual(["jumpy", "steady"]);
  });

  it("wears a back piece behind the body, seen only past its edge", () => {
    const worn = probeStill(packLook(["trial/hem"]), REST, false);
    const changed = worn.worn.flatMap((row, y) =>
      [...row].flatMap((cell, x): [number, number][] =>
        cell !== worn.bare[y]![x] ? [[x, y]] : [],
      ),
    );
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every(([x, y]) => worn.bare[y]![x] === ".")).toBe(true);
  });

  it("swaps a piece for its posed variant in the scenes it names", () => {
    const look = packLook(["trial/mask"]);
    const eyesRow = (key: string) => sceneOf(look, key)!.hero[0]!.slice(19, 23).join("");
    expect(eyesRow("idle")).toContain("E");
    expect(eyesRow("building/0")).not.toContain("E");
  });

  it("lets a cheer's frame swap any worn piece, the one on the back too", () => {
    const frames = sceneOf(outfitLook("trial/worker")!, "happy")!.hero;
    expect(frames[0]!.join("")).not.toContain("N");
    expect(frames[1]!.join("")).toContain("N");
  });

  it("draws a frame the Cell is gone from as its layers alone, where the Cell stood", () => {
    const [here, gone] = sceneOf(outfitLook("trial/rogue")!, "happy")!.hero;
    expect(here!.join("")).toMatch(/[BbLO]/);
    expect(gone!.join("")).not.toMatch(/[BbLOQE]/);
    const row = gone!.findIndex((r) => r.includes("!!!"));
    expect(row).toBeGreaterThan(20);
  });

  it("wears the original's library in an outfit: the knight's helm, plate and sword", () => {
    const knight = outfitLook("trial/knight")!;
    expect(sceneOf(knight, "idle")!.hero).toEqual(sceneOf(curated("knight")!, "idle")!.hero);
    expect(sceneOf(knight, "happy")!.hero).toEqual(sceneOf(curated("knight")!, "happy")!.hero);
  });

  it("dyes an outfit in its fabric, or its colourway's, and cheers its own cheer", () => {
    const plain = sceneOf(outfitLook("trial/worker")!, "idle")!.hero[0]!.join("");
    const rose = sceneOf(outfitLook("trial/worker", "rose")!, "idle")!.hero[0]!.join("");
    expect(plain).toContain("1");
    expect(rose).toContain("I");
    expect(rose).not.toContain("1");
    expect(sceneOf(outfitLook("trial/worker")!, "happy")!.hero).toHaveLength(2);
  });

  it("passes art that keeps every rule, a mask posed down only at work included", () => {
    for (const subject of [
      "outfit trial/knight",
      "trial/cap",
      "trial/hem",
      "trial/mask",
      "trial/mask-down",
      "outfit trial/rogue",
      "outfit trial/worker",
      "trial/worker~rose",
      "outfit trial/masked",
    ])
      expect(rules(subject), subject).toEqual([]);
    expect(rules("trial/0")).toEqual([]);
    expect(about("temperament steady")).toEqual([]);
  });

  it("probes a posed variant only in the scenes it is worn in", () => {
    // The wide hem leaves the canvas when busy/9 leans; it is only worn in the wave.
    expect(rules("trial/hem-up", "warn")).toEqual([]);
    expect(rules("trial/hem-up")).toEqual([]);
  });

  it("fails each broken rule, and names it", () => {
    expect(rules("faulty/spire")).toContain("box");
    expect(rules("faulty/visor")).toContain("eyes");
    expect(rules("faulty/soot")).toEqual(expect.arrayContaining(["void", "contrast"]));
    expect(rules("faulty/beard")).toContain("mouth");
    expect(rules("faulty/flicker")).toContain("beat");
    expect(rules("faulty/smudge")).toContain("letters");
    expect(rules("faulty/turn")).toContain("poses");
    expect(rules("faulty/two")).toContain("apart");
    expect(rules("faulty")).toContain("season");
    expect(rules("trial/1")).toEqual(["beat", "next", "tell"]);
    expect(rules("temperament jumpy")).toEqual(["temperament"]);
  });

  it("never lets a drawn pack or scene replace the original's", () => {
    const all = check();
    const fails = (subject: string) =>
      all.filter((f) => f.subject === subject && f.level === "fail").map((f) => f.rule);
    expect(fails("house")).toEqual(["theme"]);
    expect(fails("elsewhere")).toEqual(["theme"]);
    expect(fails("trial: idle")).toEqual(["scene"]);
    expect(SCENES.get("idle")?.frames[0]?.pose.eyes).toBe("calm");
    expect(pieceOf("house/duck")).toBeDefined();
  });
});
