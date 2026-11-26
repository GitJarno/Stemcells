import { describe, expect, it, vi } from "vite-plus/test";

const settings = vi.hoisted(() => ({
  toolCallVisibility: "showAll" as string,
  writes: [] as unknown[],
}));

vi.mock("../upstream/settings", () => ({
  ensureClientSettingsHydrated: async () => undefined,
  getClientSettings: () => ({ toolCallVisibility: settings.toolCallVisibility }),
  updateClientSettings: async (patch: { toolCallVisibility: string }) => {
    settings.writes.push(patch);
    settings.toolCallVisibility = patch.toolCallVisibility;
  },
}));

import { quietWorkOnce } from "./quietWork";

function setup(visibility: string) {
  settings.toolCallVisibility = visibility;
  settings.writes = [];
  const kept = new Map<string, string>();
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
  };
}

describe("quietWorkOnce", () => {
  it("turns Show all to Hide successful once, and leaves the person's later pick", async () => {
    const storage = setup("showAll");
    await quietWorkOnce(storage);
    expect(settings.writes).toEqual([{ toolCallVisibility: "hideSuccessful" }]);
    settings.toolCallVisibility = "showAll";
    await quietWorkOnce(storage);
    expect(settings.writes).toHaveLength(1);
  });

  it("leaves a mode the person chose", async () => {
    const storage = setup("zen");
    await quietWorkOnce(storage);
    expect(settings.writes).toEqual([]);
  });
});
