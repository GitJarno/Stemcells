import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import type { WindowsBridge } from "../windows/bridge";
import { openTab, serializeWorkspace, type Workspace } from "./layout";

const cell = (threadId: string) => ({ environmentId: "env", threadId, draftId: null });
const one: Workspace = openTab(
  { tabs: [], activeTabId: null },
  { tab: "t1", row: "r1", column: "c1", pane: "p1" },
  cell("x"),
);
const two: Workspace = openTab(one, { tab: "t2", row: "r2", column: "c2", pane: "p2" }, cell("y"));

/** The tab store as one desktop window loads it, with the bridge the preload exposes. */
async function loadStore(boot: WindowsBridge["boot"], stored: Workspace | null = null) {
  const published: unknown[] = [];
  const adopters: Array<(workspace: unknown) => void> = [];
  const bridge = {
    boot,
    publish: (workspace: unknown) => published.push(workspace),
    snapshot: () => Promise.reject(new Error("unused")),
    commit: () => Promise.reject(new Error("unused")),
    onAdopt: (listener: (workspace: unknown) => void) => {
      adopters.push(listener);
      return () => {};
    },
    onLead: () => () => {},
    onClosed: () => () => {},
    onReturned: () => () => {},
  } satisfies WindowsBridge;
  const storage = new Map<string, string>();
  if (stored) storage.set("stemcells.tabs", JSON.stringify(serializeWorkspace(stored)));
  vi.stubGlobal("window", { stemcellsWindows: bridge });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.resetModules();
  const store = await import("./store");
  return {
    store,
    published,
    adopt: (workspace: unknown) => adopters.forEach((a) => a(workspace)),
    storage,
  };
}

// The first load transforms the store's whole module graph, seconds on a busy
// machine; each test then loads it fresh from that cache.
beforeAll(async () => {
  await loadStore({ id: "w0", lead: false, workspace: null });
  vi.unstubAllGlobals();
}, 60_000);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the tab store in a desktop window", () => {
  it("starts from the workspace the desktop app keeps for the window, and publishes each change there", async () => {
    const { store, published, storage } = await loadStore(
      { id: "w1", lead: false, workspace: serializeWorkspace(one) },
      two,
    );
    expect(store.readWorkspace()).toEqual(one);
    const three = openTab(one, { tab: "t3", row: "r3", column: "c3", pane: "p3" }, cell("z"));
    store.updateWorkspace(() => three);
    expect(published).toEqual([serializeWorkspace(three)]);
    // The copy kept before there were windows is left as it was.
    expect(JSON.parse(storage.get("stemcells.tabs")!)).toEqual(serializeWorkspace(two));
  });

  it("takes a workspace a move gave it without publishing it back, and marks it moved", async () => {
    const { store, published, adopt } = await loadStore({
      id: "w1",
      lead: true,
      workspace: serializeWorkspace(one),
    });
    adopt(serializeWorkspace(two));
    expect(store.readWorkspace()).toEqual(two);
    expect(store.useWorkspaceStore.getState().moved).toBe(true);
    expect(published).toEqual([]);
    store.updateWorkspace((current) => ({ ...current, activeTabId: "t1" }));
    expect(store.useWorkspaceStore.getState().moved).toBe(false);
  });

  it("makes the first window, as it leads, take the tabs kept before there were windows", async () => {
    const { store, published } = await loadStore({ id: "w1", lead: true, workspace: null }, two);
    expect(store.readWorkspace()).toEqual(two);
    expect(published).toEqual([serializeWorkspace(two)]);
  });

  it("starts any other new window empty", async () => {
    const { store } = await loadStore({ id: "w2", lead: false, workspace: null }, two);
    expect(store.readWorkspace().tabs).toEqual([]);
  });
});
