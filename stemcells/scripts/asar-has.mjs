// Whether an Electron app.asar holds a file of the given name, anywhere in
// it, read from the archive's header: exits 0 if it does, 1 if not.
//
//   node stemcells/scripts/asar-has.mjs <app.asar> <file name>
import * as NodeFS from "node:fs";

const [archive, name] = process.argv.slice(2);
if (!archive || !name) {
  console.error("usage: asar-has.mjs <app.asar> <file name>");
  process.exit(2);
}

// The header: a pickle holding its size, then a pickle holding its JSON,
// whose length sits at byte 12 and whose text starts at byte 16.
const fd = NodeFS.openSync(archive, "r");
const start = Buffer.alloc(16);
NodeFS.readSync(fd, start, 0, 16, 0);
const json = Buffer.alloc(start.readUInt32LE(12));
NodeFS.readSync(fd, json, 0, json.length, 16);
NodeFS.closeSync(fd);

/** Whether `dir` (a header folder) holds a file named `name`, at any depth. */
function holds(dir) {
  return Object.entries(dir.files ?? {}).some(
    ([entry, node]) => (entry === name && !node.files) || (node.files !== undefined && holds(node)),
  );
}

process.exit(holds(JSON.parse(json.toString("utf8"))) ? 0 : 1);
