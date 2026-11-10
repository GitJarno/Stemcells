import type { ModelSelection, ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { selectionOnAccount } from "./accountSelection";

const account = (instanceId: string, slugs: ReadonlyArray<string>): ServerProvider =>
  ({
    instanceId,
    driver: "claudeAgent",
    enabled: true,
    models: slugs.map((slug) => ({ slug, name: slug, isCustom: false, capabilities: null })),
  }) as unknown as ServerProvider;

const cell = { instanceId: "work", model: "claude-sonnet" } as unknown as ModelSelection;

describe("a Cell's selection on another account", () => {
  it("keeps its model on an account that offers it, and is none where it can't run", () => {
    const providers = [account("work", ["claude-sonnet"]), account("home", ["claude-sonnet"])];
    expect(selectionOnAccount(providers, cell, "home")).toMatchObject({
      instanceId: "home",
      model: "claude-sonnet",
    });
    expect(selectionOnAccount(providers, cell, "gone")).toBeNull();
    expect(selectionOnAccount([account("home", ["claude-haiku"])], cell, "home")).toBeNull();
  });
});
