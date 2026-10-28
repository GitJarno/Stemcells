// @effect-diagnostics nodeBuiltinImport:off - reads upstream's hot files on disk.
/**
 * Contract: each upstream hot file we edit reads all of ours through one import on its first
 * line: `import * as Stemcells from "…/stemcells/upstream/seams/<File>"`. Upstream edits import
 * blocks all day but rarely a first line, so a second name goes in the file's module here
 * (`stemcells/seams.md`, "One import per hot file").
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");

/** Each hot file, and the module of ours it imports. */
const HOT_FILES: Readonly<Record<string, string>> = {
  "apps/web/src/components/ChatView.tsx": "../stemcells/upstream/seams/ChatView",
  "apps/web/src/components/chat/MessagesTimeline.tsx": "../../stemcells/upstream/seams/chat",
  "apps/web/src/components/chat/ChatComposer.tsx": "../../stemcells/upstream/seams/chat",
  // Split out of MessagesTimeline.tsx and ChatView.tsx (2026-10-21), with their churn.
  "apps/web/src/components/chat/TimelineWorkGroupRows.tsx": "../../stemcells/upstream/seams/chat",
  "apps/web/src/components/chat/TimelineWorkEntryRow.tsx": "../../stemcells/upstream/seams/chat",
  "apps/web/src/components/chat/TimelineV2EventRow.tsx": "../../stemcells/upstream/seams/chat",
};

/** An import of ours: our folders, the repository's `stemcells/`, or our files in upstream's folders. */
const OURS = /\/stemcells\/|\/chatWindowInput["']/;

function importsOf(
  source: string,
): ReadonlyArray<{ readonly line: number; readonly text: string }> {
  return [
    ...source.matchAll(/^import\b[\s\S]*?\bfrom\s*["'][^"']+["'];?$|^import\s*["'][^"']+["'];?$/gm),
  ].map((match) => ({ line: source.slice(0, match.index).split("\n").length, text: match[0] }));
}

describe("one import per hot file", () => {
  it.each(Object.entries(HOT_FILES))(
    "%s reads ours through %s, on its first line",
    (file, module) => {
      const source = NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8");
      const ours = importsOf(source).filter(({ text }) => OURS.test(text));
      expect(ours).toEqual([{ line: 1, text: `import * as Stemcells from "${module}";` }]);
      expect(
        NodeFS.existsSync(NodePath.resolve(repoRoot, NodePath.dirname(file), `${module}.ts`)),
      ).toBe(true);
    },
  );
});
