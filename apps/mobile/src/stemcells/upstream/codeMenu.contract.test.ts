// @effect-diagnostics nodeBuiltinImport:off - reads upstream's file: Node can't load React Native.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Contract: a chat's header hands its bar the files button as its one action and git's and the
 * terminal's menus as its menus, which the Code menu folds (`chat/code.ts`). If this fails after a
 * sync, the header shows upstream's buttons beside Code, or Code holds one that isn't a way into
 * the working copy: fold what upstream now hands it.
 */
describe("what a chat's header hands its bar", () => {
  const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
  const source = NodeFS.readFileSync(
    NodePath.resolve(here, "../../features/threads/ThreadHeader.tsx"),
    "utf8",
  );

  it("is the files button as its actions, and git and terminal as its menus", () => {
    expect(source).toContain("actions={actions}");
    expect(source).toContain("menus={menus}");
    expect(source).toContain("const menus = [gitMenu, terminalMenu]");
    const actions = /const actions: AppBarAction\[\] = ([\s\S]*?\n {4}: \[\]);/.exec(source)?.[1];
    expect(actions?.match(/icon: "[^"]+"/g)).toEqual(['icon: "folder"']);
  });
});
