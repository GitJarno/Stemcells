// Resolves a sync's conflicts in upstream's tests, where our only edits are line swaps pinning
// a name or path our seams change: upstream's file wins, each swap goes back where it still has
// the line, and a file left as upstream's leaves `stemcells/seams.md`. Anything else is left.
//
//   node stemcells/scripts/resolve-test-seams.mjs [--preview OURS THEIRS (writes nothing)]
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";

const git = (...args) =>
  NodeChildProcess.execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const has = (rev, file) =>
  NodeChildProcess.spawnSync("git", ["cat-file", "-e", `${rev}:${file}`]).status === 0;

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SEAMS = "stemcells/seams.md";

/** Our edits to `file` from `base` to `ours`, as [removed lines, added lines] blocks. */
function ourEdits(base, ours, file) {
  const hunks = [];
  let current = null;
  for (const line of git(
    "diff",
    "-U0",
    "--no-color",
    "--no-ext-diff",
    base,
    ours,
    "--",
    file,
  ).split("\n")) {
    if (line.startsWith("@@")) hunks.push((current = { removed: [], added: [] }));
    // One file's diff: its header lines all come before the first hunk.
    else if (current && line.startsWith("-")) current.removed.push(line.slice(1));
    else if (current && line.startsWith("+")) current.added.push(line.slice(1));
  }
  return hunks;
}

const indexOfBlock = (lines, block, from = 0) => {
  for (let i = from; i + block.length <= lines.length; i++) {
    if (block.every((line, j) => lines[i + j] === line)) return i;
  }
  return -1;
};

/** Upstream's file with our swaps put back, or why it can't be done safely. */
function reapply(base, ours, theirs, file) {
  const oursLines = git("show", `${ours}:${file}`).split("\n");
  const theirsText = git("show", `${theirs}:${file}`);
  const swaps = new Map();
  for (const { removed, added } of ourEdits(base, ours, file)) {
    if (removed.length === 0) return { left: "our edit adds lines without replacing any" };
    const key = removed.join("\n");
    if (swaps.has(key) && swaps.get(key).join("\n") !== added.join("\n")) {
      return { left: "we swap the same lines two ways" };
    }
    // A line we swapped in one place but kept as-is in another isn't a
    // swap we can put back everywhere upstream has it.
    if (indexOfBlock(oursLines, removed) !== -1)
      return { left: "we keep a line we swap elsewhere" };
    swaps.set(key, added);
  }
  let lines = theirsText.split("\n");
  let applied = 0;
  let gone = 0;
  for (const [key, added] of swaps) {
    const removed = key.split("\n");
    let at = indexOfBlock(lines, removed);
    if (at === -1) gone++;
    else applied++;
    while (at !== -1) {
      lines = [...lines.slice(0, at), ...added, ...lines.slice(at + removed.length)];
      at = indexOfBlock(lines, removed, at + added.length);
    }
  }
  const text = lines.join("\n");
  return { text, applied, gone, same: text === theirsText };
}

/** `seams.md` without `files` in any row's first column; a row naming no file then goes. */
function dropFromSeams(seams, files) {
  return seams
    .split("\n")
    .flatMap((line) => {
      if (!line.startsWith("| `")) return [line];
      const cells = line.split(" | ");
      const named = cells[0].replace(/^\| /, "").split(", ");
      const kept = named.filter((name) => !files.some((file) => name.startsWith(`\`${file}\``)));
      if (kept.length === named.length) return [line];
      if (kept.length === 0) return [];
      return [[`| ${kept.join(", ")}`, ...cells.slice(1)].join(" | ")];
    })
    .join("\n");
}

const preview = process.argv[2] === "--preview";
let ours = "HEAD";
let theirs = "MERGE_HEAD";
let conflicted;
if (preview) {
  [ours, theirs] = [process.argv[3], process.argv[4]];
  if (!ours || !theirs) {
    console.error("usage: resolve-test-seams.mjs --preview OURS THEIRS");
    process.exit(2);
  }
  const run = NodeChildProcess.spawnSync(
    "git",
    ["merge-tree", "--write-tree", "--no-messages", "--name-only", ours, theirs],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  conflicted = run.stdout.split("\n").slice(1).filter(Boolean);
} else {
  if (!NodeFS.existsSync(git("rev-parse", "--git-path", "MERGE_HEAD").trim())) {
    console.error("resolve-test-seams: no merge in progress");
    process.exit(2);
  }
  conflicted = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
}
const base = git("merge-base", ours, theirs).trim();

let left = 0;
const unseamed = [];
for (const file of conflicted) {
  if (!TEST.test(file)) {
    console.log(`left      ${file}  (not a test: resolve by hand)`);
    left++;
    continue;
  }
  if (!has(ours, file)) {
    console.log(`left      ${file}  (we deleted it, upstream changed it)`);
    left++;
    continue;
  }
  if (!has(theirs, file)) {
    if (!preview) git("rm", "-q", "--", file);
    console.log(`deleted   ${file}  (upstream deleted it; its seams.md entry goes)`);
    unseamed.push(file);
    continue;
  }
  const result = reapply(base, ours, theirs, file);
  if (result.left) {
    console.log(`left      ${file}  (${result.left})`);
    left++;
    continue;
  }
  if (!preview) {
    NodeFS.writeFileSync(file, result.text);
    git("add", "--", file);
  }
  const gone = result.gone ? `, ${result.gone} gone upstream` : "";
  const same = result.same ? "; same as upstream's now, its seams.md entry goes" : "";
  console.log(`resolved  ${file}  (${result.applied} of our swaps put back${gone}${same})`);
  if (result.same) unseamed.push(file);
}

if (!preview && unseamed.length > 0) {
  NodeFS.writeFileSync(SEAMS, dropFromSeams(NodeFS.readFileSync(SEAMS, "utf8"), unseamed));
  git("add", "--", SEAMS);
}
process.exit(left === 0 ? 0 : 1);
