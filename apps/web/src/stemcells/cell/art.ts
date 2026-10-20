// Art drawn for Stemcells beside the original's export (`kit/`): one JSON
// file per pack, move set or temperament under `art/`, so drawings made in
// parallel never share a file. The app and its tests read them through
// Vite's glob; plain node (the tools in `tools/`) reads them from disk.
// Formats: `stemcells/docs/cell-art.md`.

/** Files by name (no folder, no `.json`), in name order. */
export type ArtFiles = Readonly<Record<string, unknown>>;

const byName = (files: Readonly<Record<string, unknown>>): ArtFiles =>
  Object.fromEntries(
    Object.keys(files)
      .toSorted()
      .map((path) => [path.slice(path.lastIndexOf("/") + 1).replace(/\.json$/, ""), files[path]]),
  );

interface Disk {
  readonly existsSync: (path: URL) => boolean;
  readonly readdirSync: (path: URL) => string[];
  readonly readFileSync: (path: URL, encoding: "utf8") => string;
}

/** `art/<folder>`'s files, read from disk: for node, where no bundler globbed them. */
function fromDisk(folder: string): ArtFiles {
  const process = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
    .process;
  const fs = process?.getBuiltinModule?.("node:fs") as Disk | undefined;
  const dir = new URL(`./art/${folder}/`, import.meta.url);
  if (fs === undefined || !fs.existsSync(dir)) return {};
  const files: Record<string, unknown> = {};
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".json"))
      files[name] = JSON.parse(fs.readFileSync(new URL(name, dir), "utf8")) as unknown;
  }
  return byName(files);
}

/** Packs: pieces, fabrics, outfits and their cheers. */
export const ART_PACKS: ArtFiles = import.meta.env
  ? byName(import.meta.glob("./art/packs/*.json", { eager: true, import: "default" }))
  : fromDisk("packs");

/** Moves: new scenes, and meta for the original's. */
export const ART_MOVES: ArtFiles = import.meta.env
  ? byName(import.meta.glob("./art/moves/*.json", { eager: true, import: "default" }))
  : fromDisk("moves");

/** Temperaments, one a file. */
export const ART_TEMPERAMENTS: ArtFiles = import.meta.env
  ? byName(import.meta.glob("./art/temperaments/*.json", { eager: true, import: "default" }))
  : fromDisk("temperaments");
