import * as NodePath from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { boundaryOf, importSpecifiers } from "./check.ts";

describe("the check on Stemcells' boundary with upstream", () => {
  const repo = NodePath.resolve("/repo");
  const ourRoot = NodePath.join(repo, "apps", "web", "src", "stemcells");
  const { upstreamReach } = boundaryOf(ourRoot);
  const reached = (file: string, source: string) =>
    importSpecifiers(source).filter((specifier) => upstreamReach(file, specifier));

  it("catches each way of reaching upstream, and lets the rest through", () => {
    const tabFile = NodePath.join(ourRoot, "tabs", "Example.tsx");
    const source = [
      'import ChatView from "../../components/ChatView";',
      'import { cn } from "~/lib/utils";',
      'export { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";',
      'const lazy = () => import("../../routes/_chat");',
      'import * as Acp from "effect-acp/client";',
      'const config = require("../../../app.config");',
      'vi.mock("~/state/threads", () => ({}));',
      'import { useState } from "react";',
      'import * as Effect from "effect/Effect";',
      'import { panesOf } from "./layout";',
      'import { Button } from "../upstream/ui";',
      'import { MARK_CURSOR } from "../../../../../stemcells/brand/mark.ts";',
    ].join("\n");
    expect(reached(tabFile, source)).toEqual([
      "../../components/ChatView",
      "~/lib/utils",
      "@t3tools/shared/keybindings",
      "../../routes/_chat",
      "effect-acp/client",
      "../../../app.config",
      "~/state/threads",
    ]);
    const adapterFile = NodePath.join(ourRoot, "upstream", "chat.tsx");
    expect(upstreamReach(adapterFile, "../../components/ChatView")).toBeNull();
  });

  it("counts another app's code of ours as ours, but not its adapter or its upstream code", () => {
    const kitFile = NodePath.join(repo, "apps", "mobile", "src", "stemcells", "cell", "kit.ts");
    const phone = boundaryOf(NodePath.join(repo, "apps", "mobile", "src", "stemcells"));
    const reach = (specifier: string) => phone.upstreamReach(kitFile, specifier);
    expect(reach("../../../../web/src/stemcells/cell/look.ts")).toBeNull();
    expect(reach("../../../../web/src/stemcells/upstream/cells.ts")).toBe("another app's adapter");
    expect(reach("../../../../web/src/components/ChatView")).toBe(
      "upstream app code (relative path)",
    );
  });
});
