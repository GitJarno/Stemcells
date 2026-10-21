// @effect-diagnostics nodeBuiltinImport:off - a command line: it reads arguments and writes files.
// `stemcells/scripts/cells`: draw, check and lay out Cell art from a
// worktree, with no dev server. Usage: `stemcells/docs/cell-art.md`.

import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { PACKS } from "../kit.ts";
import { dayOf, looksOf } from "../looks.ts";
import { wornLook } from "../scene.ts";
import { check, looksOfPack } from "./check.ts";
import { animation, contactSheet, GROUNDS, lookOf, sheetOf, SIZES, slugOf } from "./draw.ts";
import { lookbook } from "./lookbook.ts";

const USAGE = `cells: draw, check and lay out Cell art (stemcells/docs/cell-art.md)

  cells render <look> [scene…]   every frame of each scene, both sizes, both frames:
                                 a sheet (PNG) and an animation per size and frame (APNG)
  cells pack <theme>             a sheet of every piece and outfit of a pack, still
  cells lookbook [theme…]        a page of packs, animated (every drawn pack by default)
  cells crew [day] [count]       a sheet of a crew in view, dealt together on a day
                                 (YYYY-MM-DD, today by default; twelve Cells by default)
  cells check [theme…] [--original]
                                 the rules; exits 1 on a failure. --original adds notes
                                 on the original's art

  <look>    bare | builder | gym/towel+gym/sweatband | outfit:gym/athlete[~sky]
            any grown to a strength, cheering a landing: bare@arms | bare@biceps:flex
            | bare@:added:removed (the marks of the lines it added and removed)
  options   --body claude|codex|gemini|kimi|frost   --out <dir>   (default: $TMPDIR/cells)`;

const DEFAULT_SCENES = ["idle", "happy", "waiting", "asleep"];

function parse(argv: readonly string[]) {
  const words: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i]!;
    if (!word.startsWith("--")) words.push(word);
    else if (word === "--original" || word === "--help") flags.set(word.slice(2), true);
    else flags.set(word.slice(2), argv[++i] ?? "");
  }
  return { words, flags };
}

function write(path: string, bytes: Uint8Array | string): string {
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  NodeFS.writeFileSync(path, bytes);
  return path;
}

function main(argv: readonly string[]): number {
  const { words, flags } = parse(argv);
  const [command, ...rest] = words;
  const body = typeof flags.get("body") === "string" ? (flags.get("body") as string) : "claude";
  const out =
    typeof flags.get("out") === "string"
      ? (flags.get("out") as string)
      : NodePath.join(NodeOS.tmpdir(), "cells");
  switch (command) {
    case "render": {
      const [spec, ...keys] = rest;
      if (spec === undefined) break;
      const scenes = keys.length > 0 ? keys : DEFAULT_SCENES;
      const dir = NodePath.join(out, slugOf(spec));
      console.log(write(NodePath.join(dir, "sheet.png"), sheetOf(spec, scenes, body)));
      const look = lookOf(spec);
      for (const key of scenes)
        for (const size of SIZES)
          for (const ground of GROUNDS) {
            const bytes = animation(look, key, body, size, ground);
            if (bytes !== undefined)
              console.log(
                write(NodePath.join(dir, `${slugOf(key)}.${size}.${ground}.apng`), bytes),
              );
          }
      return 0;
    }
    case "pack": {
      const [theme] = rest;
      if (theme === undefined) break;
      if (!PACKS.some((pack) => pack.theme === theme)) throw new Error(`no pack "${theme}"`);
      const looks = looksOfPack(theme).map(({ label, look }) => [label, look] as const);
      console.log(
        write(
          NodePath.join(out, `pack-${slugOf(theme)}.png`),
          contactSheet(theme, looks, ["idle", "happy"], body),
        ),
      );
      return 0;
    }
    case "lookbook": {
      const scenes =
        typeof flags.get("scenes") === "string"
          ? (flags.get("scenes") as string).split(",")
          : DEFAULT_SCENES;
      console.log(write(NodePath.join(out, "lookbook.html"), lookbook(rest, scenes, body)));
      return 0;
    }
    case "crew": {
      const [day = dayOf(new Date()), count = "12"] = rest;
      const names = Array.from({ length: Number(count) }, (_, i) => `cell-${i + 1}`);
      const looks = [...looksOf(names, day).values()].map(
        (look) => [look.worn.join(" ") || "bare", wornLook(look.worn)] as const,
      );
      console.log(
        write(
          NodePath.join(out, `crew-${slugOf(day)}.png`),
          contactSheet(`crew ${day}`, looks, ["idle", "happy"], body),
        ),
      );
      return 0;
    }
    case "check": {
      const findings = check({ themes: rest, original: flags.get("original") === true });
      const count = (level: string) => findings.filter((f) => f.level === level).length;
      for (const level of ["fail", "warn", "note"] as const)
        for (const f of findings.filter((finding) => finding.level === level))
          console.log(`${level.padEnd(4)} ${f.rule.padEnd(9)} ${f.subject}: ${f.detail}`);
      const notes = count("note") > 0 ? `, ${count("note")} notes on the original's art` : "";
      console.log(
        count("fail") === 0
          ? `check: the drawn art passes (${count("warn")} warnings${notes})`
          : `check: ${count("fail")} failures, ${count("warn")} warnings${notes}`,
      );
      return count("fail") === 0 ? 0 : 1;
    }
  }
  console.log(USAGE);
  return command === undefined || flags.has("help") ? 0 : 2;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`cells: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
