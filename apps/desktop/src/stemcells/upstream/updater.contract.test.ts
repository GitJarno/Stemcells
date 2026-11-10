// @effect-diagnostics nodeBuiltinImport:off -- Reads upstream's sources as they are on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { desktopUpdateChannelOf } from "@t3tools/shared/cliRelease";
import { describe, expect, it } from "vite-plus/test";

import { normalizeDesktopUpdateReleaseNotes } from "../../updates/releaseNotes.ts";
import { nightlyNotesOf, nightlyVersionOf } from "../updates/changes.ts";

/**
 * Contract: what Stemcells' updater leans on in upstream's desktop app that
 * its types don't say (`updater.ts`): who talks to electron-updater, the
 * event names upstream's updater listens for, the commit its build stamps
 * into the app, and how it reads a version and its notes.
 */
const desktopSource = NodePath.resolve(import.meta.dirname, "../..");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(desktopSource, file), "utf8");

/** The desktop's own modules, by path under `src`. */
const desktopModules = (folder = desktopSource): string[] =>
  NodeFS.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = NodePath.join(folder, entry.name);
    if (entry.isDirectory()) return desktopModules(path);
    return /\.tsx?$/u.test(entry.name) && !/\.test\.tsx?$/u.test(entry.name)
      ? [NodePath.relative(desktopSource, path)]
      : [];
  });

describe("upstream's desktop updater, as Stemcells' stands beneath it", () => {
  // A build names origin as its feed (install-app), which electron-updater
  // would reach out to read: upstream's updater is its one user, and runs
  // on ours.
  it("leaves electron-updater no one to fetch for", () => {
    const users = desktopModules().filter((file) =>
      /from "(?:\.\.?\/)+electron\/ElectronUpdater\.ts"/u.test(read(file)),
    );
    expect(users.toSorted()).toEqual([
      "main.ts",
      "stemcells/upstream/updater.ts",
      "updates/DesktopUpdates.ts",
      "updates/updatesTestHarness.ts",
    ]);
    expect(read("main.ts")).toMatch(
      /DesktopUpdates\.layer\.pipe\(\s*Layer\.provide\(StemcellsUpdater\.layer\)/,
    );
  });

  it("listens for each event our updater tells it by", () => {
    const told = [
      ...read("stemcells/upstream/updater.ts").matchAll(/events\.emit\("([^"]+)"/g),
    ].map((match) => match[1]!);
    expect(told.toSorted()).toEqual([
      "checking-for-update",
      "download-progress",
      "update-available",
      "update-downloaded",
      "update-not-available",
    ]);
    const upstream = read("updates/DesktopUpdates.ts");
    for (const name of told) expect(upstream).toContain(`electronUpdater.on("${name}"`);
  });

  it("stamps the commit a build was made from where our updater reads it", () => {
    const build = NodeFS.readFileSync(
      NodePath.resolve(desktopSource, "../../../scripts/build-desktop-artifact.ts"),
      "utf8",
    );
    expect(build).toMatch(/\bt3codeCommitHash: commitHash\b/);
  });

  it("shows each day's merges as a nightly's notes, as it shows T3's", () => {
    // Ten merged on the 23rd, two on the 22nd: commits 7268 back to 7257.
    const changes = [
      ...Array.from({ length: 10 }, (_, index) => ({
        title: `Today ${index}`,
        number: 300 - index,
        day: "20261023",
      })),
      { title: "Yesterday", number: 200, day: "20261022" },
      { title: "Yesterday too", number: 199, day: "20261022" },
    ];
    const tip = nightlyVersionOf({ base: "0.1.1", day: "20261023", count: 7268 });
    const { releaseNotes } = normalizeDesktopUpdateReleaseNotes(
      nightlyNotesOf(changes, { base: "0.1.1", count: 7268 }),
      tip,
      "nightly",
    );

    expect(releaseNotes.map((note) => [note.version, note.totalItems])).toEqual([
      [tip, 10],
      ["0.1.1-nightly.20261022.7258", 2],
    ]);
    // Upstream lists a nightly's 8 newest, and links the rest.
    expect(releaseNotes[0]?.items).toHaveLength(8);
    expect(releaseNotes[0]?.items[0]).toBe("Today 0 (#300)");
    expect(releaseNotes[1]?.items).toEqual(["Yesterday (#200)", "Yesterday too (#199)"]);
  });

  it("files a main build under its Nightly, and a release under its Stable", () => {
    expect(
      desktopUpdateChannelOf(nightlyVersionOf({ base: "0.1.1", day: "20261023", count: 7268 })),
    ).toBe("nightly");
    expect(desktopUpdateChannelOf("0.2.0")).toBe("latest");
  });
});
