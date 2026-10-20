// @effect-diagnostics nodeBuiltinImport:off - reads our source files on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

/**
 * Only `upstream/` may import upstream's code. Everything else in our folder
 * goes through it, so when upstream changes shape the type checker fails in
 * one place (stemcells/docs/fork.md, rule 2).
 */

const thisFile = NodeURL.fileURLToPath(import.meta.url);
const ourRoot = NodePath.dirname(thisFile);
const adapterRoot = NodePath.join(ourRoot, "upstream");

const IMPORT_PATTERN =
  /\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2] ?? match[3]!);
}

/** Why `specifier`, imported by `file`, reaches into upstream; null when it doesn't. */
function upstreamReach(file: string, specifier: string): string | null {
  if (file.startsWith(adapterRoot + NodePath.sep)) return null;
  if (specifier.startsWith("~/")) return "upstream app code (~/)";
  if (specifier.startsWith("@t3tools/")) return "an upstream package";
  if (specifier.startsWith(".")) {
    const resolved = NodePath.resolve(NodePath.dirname(file), specifier);
    if (resolved !== ourRoot && !resolved.startsWith(ourRoot + NodePath.sep)) {
      return "upstream app code (relative path)";
    }
  }
  return null;
}

function ourSourceFiles(): string[] {
  return (
    NodeFS.readdirSync(ourRoot, { recursive: true })
      .map(String)
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => NodePath.join(ourRoot, file))
      // This file's examples below are strings, not imports.
      .filter((file) => file !== thisFile)
  );
}

describe("Stemcells' boundary with upstream", () => {
  it("only the upstream adapter imports upstream's code", () => {
    const files = ourSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((file) =>
      importSpecifiers(NodeFS.readFileSync(file, "utf8")).flatMap((specifier) => {
        const reach = upstreamReach(file, specifier);
        return reach
          ? [`${NodePath.relative(ourRoot, file)} imports "${specifier}": ${reach}`]
          : [];
      }),
    );
    expect(violations).toEqual([]);
  });

  it("catches each way of reaching upstream, and lets the rest through", () => {
    const tabFile = NodePath.join(ourRoot, "tabs", "Example.tsx");
    const source = [
      'import ChatView from "../../components/ChatView";',
      'import { cn } from "~/lib/utils";',
      'export { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";',
      'const lazy = () => import("../../routes/_chat");',
      'import { useState } from "react";',
      'import { create } from "zustand";',
      'import { panesOf } from "./layout";',
      'import { Button } from "../upstream/ui";',
    ].join("\n");
    const reached = importSpecifiers(source).filter((specifier) =>
      upstreamReach(tabFile, specifier),
    );
    expect(reached).toEqual([
      "../../components/ChatView",
      "~/lib/utils",
      "@t3tools/shared/keybindings",
      "../../routes/_chat",
    ]);
    const adapterFile = NodePath.join(adapterRoot, "chat.tsx");
    expect(upstreamReach(adapterFile, "../../components/ChatView")).toBeNull();
  });
});
