// @effect-diagnostics nodeBuiltinImport:off - reads upstream's file: Node can't load React Native.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { CODE_ITEM_IDS } from "../chat/code";

/**
 * Contract: a chat's header items for git, files and terminal still carry the identifiers the
 * Code button folds by (`chat/code.ts`). If this fails after a sync, the header shows upstream's
 * three buttons again: fold by the new identifiers.
 */
describe("the header items the Code button folds", () => {
  it("keep their identifiers in upstream's git controls", () => {
    const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
    const source = NodeFS.readFileSync(
      NodePath.resolve(here, "../../features/threads/ThreadGitControls.tsx"),
      "utf8",
    );
    for (const id of CODE_ITEM_IDS) expect(source).toContain(`identifier: "${id}"`);
  });
});
