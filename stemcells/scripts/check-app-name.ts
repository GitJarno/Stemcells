// Whether a built Stemcells says "T3 Code" only inside words stemcells/brand/nameTransform.ts
// keeps, in what an install ships: a folder whole, or the server, web and desktop main inside
// an archive. Exits 0 when it does, 1 with each unexplained line when not.
//
//   node stemcells/scripts/check-app-name.ts <app.asar | folder>...
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { unexplainedNames } from "../brand/nameTransform.ts";

const CHECKED = /\.(?:js|mjs|cjs|html|json|webmanifest)$/;
const IN_ARCHIVE = /^apps\/(?:server\/dist|desktop\/dist-electron)\//;

interface Entry {
  readonly files?: Record<string, Entry>;
  readonly size?: number;
  readonly offset?: string;
  readonly unpacked?: boolean;
}

/** Each checked file in an Electron archive, with its text. */
function* archiveFiles(archive: string): Generator<[string, string]> {
  // The header: a pickle holding its size, then a pickle holding its JSON,
  // whose length sits at byte 12 and whose text starts at byte 16.
  const fd = NodeFS.openSync(archive, "r");
  try {
    const start = Buffer.alloc(16);
    NodeFS.readSync(fd, start, 0, 16, 0);
    const dataStart = 8 + start.readUInt32LE(4);
    const json = Buffer.alloc(start.readUInt32LE(12));
    NodeFS.readSync(fd, json, 0, json.length, 16);
    const walk = function* (entry: Entry, path: string): Generator<[string, string]> {
      for (const [name, child] of Object.entries(entry.files ?? {})) {
        const childPath = path === "" ? name : `${path}/${name}`;
        if (child.files !== undefined) {
          yield* walk(child, childPath);
          continue;
        }
        if (!IN_ARCHIVE.test(childPath) || !CHECKED.test(name)) continue;
        if (child.unpacked === true) {
          yield [childPath, NodeFS.readFileSync(`${archive}.unpacked/${childPath}`, "utf8")];
          continue;
        }
        const body = Buffer.alloc(child.size ?? 0);
        NodeFS.readSync(fd, body, 0, body.length, dataStart + Number(child.offset ?? 0));
        yield [childPath, body.toString("utf8")];
      }
    };
    yield* walk(JSON.parse(json.toString("utf8")) as Entry, "");
  } finally {
    NodeFS.closeSync(fd);
  }
}

/** Each checked file under a folder, with its text. */
function* folderFiles(folder: string): Generator<[string, string]> {
  for (const file of NodeFS.readdirSync(folder, { recursive: true, encoding: "utf8" })) {
    const path = NodePath.join(folder, file);
    if (CHECKED.test(file) && NodeFS.statSync(path).isFile()) {
      yield [path, NodeFS.readFileSync(path, "utf8")];
    }
  }
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node stemcells/scripts/check-app-name.ts <app.asar | folder>...");
  process.exit(2);
}

let checked = 0;
const unexplained: string[] = [];
for (const target of targets) {
  const files = NodeFS.statSync(target).isDirectory() ? folderFiles(target) : archiveFiles(target);
  for (const [file, text] of files) {
    checked += 1;
    for (const words of unexplainedNames(text)) unexplained.push(`${file}: ${words}`);
  }
}

if (checked === 0) {
  console.error(`check-app-name: no built code found in ${targets.join(", ")}`);
  process.exit(1);
}
if (unexplained.length > 0) {
  console.error(
    `check-app-name: the build says "T3 Code" outside every kept place's words (stemcells/brand/nameTransform.ts):\n  ${unexplained.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`check-app-name: ${checked} built files say T3's name only where it's kept.`);
