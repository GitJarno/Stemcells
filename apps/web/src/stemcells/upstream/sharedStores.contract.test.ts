/**
 * Upstream behaviour the windows' merge relies on (`windows/storageMerge.ts`):
 * each shared store's persisted fields carry the state's own names, its own
 * hydration turns another window's write into state, its storage writes the
 * versions the merge gives it (the drafts' storage: a state it wasn't given
 * captured, as it is, when it writes) and hydrates past them, and its
 * debounced writes happen on `beforeunload`. If this fails after a sync, two
 * windows may overwrite each other's drafts again.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import composerDraftStoreSource from "../../composerDraftStore.ts?raw";
import mainSource from "../../main.tsx?raw";
import uiStateStoreSource from "../../uiStateStore.ts?raw";
import { useComposerDraftStore } from "../../composerDraftStore";
import { useRightPanelStore } from "../../rightPanelStore";
import { useTerminalUiStateStore } from "../../terminalUiStateStore";
import { mergeWrite } from "../windows/sharedStorage";
import { EntryVersions } from "../windows/storageMerge";
import { CLOCKS, sharedStores, type SharedStore } from "./sharedStores";

const ENVIRONMENT = EnvironmentId.make("environment-local");
const mine = scopeThreadRef(ENVIRONMENT, ThreadId.make("typed-here"));
const theirs = scopeThreadRef(ENVIRONMENT, ThreadId.make("typed-there"));

function reset() {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  });
  useRightPanelStore.setState({ byThreadKey: {}, threadPanelVisibilityByThreadKey: {} });
  useTerminalUiStateStore.setState({ terminalUiStateByThreadKey: {} });
}

const drafts = (): SharedStore => sharedStores()[0]!;
const persistOf = (key: string) =>
  [useComposerDraftStore, useRightPanelStore, useTerminalUiStateStore].find(
    (store) => store.persist.getOptions().name === key,
  )!.persist;
const promptOf = (ref: typeof mine) =>
  useComposerDraftStore.getState().getComposerDraft(ref)?.prompt ?? null;

describe("the shared stores' contracts with upstream", () => {
  beforeEach(reset);
  afterEach(() => {
    vi.useRealTimers();
    reset();
  });

  it("are keyed as upstream keeps them", () => {
    expect(sharedStores().map((store) => store.key)).toEqual([
      "t3code:composer-drafts:v1",
      "t3code:right-panel-state:v2",
      "t3code:terminal-state:v1",
    ]);
  });

  it("persist each field under the state's own name", () => {
    for (const store of sharedStores()) {
      const state = store.getState() as Record<string, unknown>;
      for (const field of Object.keys(store.persisted()))
        expect(state, store.key).toHaveProperty(field);
    }
  });

  it("drafts: another window's newer write lands, and what this window typed since stays", () => {
    const store = useComposerDraftStore.getState();
    store.setPrompt(mine, "mine, before");
    store.setPrompt(theirs, "theirs, before");
    const before = drafts().persisted();
    const versions = new EntryVersions("here", before);
    store.setPrompt(mine, "mine, typed since");

    const key = scopedThreadKey(theirs);
    const after = structuredClone(before) as {
      draftsByThreadKey: Record<string, { prompt: string }>;
    };
    after.draftsByThreadKey[key]!.prompt = "theirs, typed there";
    const clocks = { draftsByThreadKey: { [key]: [1, "there"] as const } };
    expect(mergeWrite(drafts(), versions, { fields: after, clocks })).toBe(true);

    expect(promptOf(mine)).toBe("mine, typed since");
    expect(promptOf(theirs)).toBe("theirs, typed there");
  });

  it("drafts: one sent in another window goes here too", () => {
    const store = useComposerDraftStore.getState();
    store.setPrompt(theirs, "theirs");
    const before = drafts().persisted();
    const versions = new EntryVersions("here", before);
    const sent = structuredClone(before) as { draftsByThreadKey: Record<string, unknown> };
    const key = scopedThreadKey(theirs);
    delete sent.draftsByThreadKey[key];
    const clocks = { draftsByThreadKey: { [key]: [1, "there"] as const } };
    expect(mergeWrite(drafts(), versions, { fields: sent, clocks })).toBe(true);
    expect(promptOf(theirs)).toBeNull();
  });

  it("each write carries its versions, and hydrates as one without", async () => {
    vi.useFakeTimers();
    const versions = { stamped: 0 };
    const clocks = () => ({ written: [(versions.stamped += 1), "here"] as const });
    const stops = sharedStores().map((store) => store.carry(clocks));
    const written = new Map<string, unknown>();
    try {
      useComposerDraftStore.getState().setPrompt(mine, "typed here");
      useRightPanelStore.getState().show(mine);
      useTerminalUiStateStore.getState().setTerminalHeight(mine, 321);
      // The drafts' write waits its moment, and its versions are worked out as it's written.
      expect(versions.stamped).toBe(2);
      vi.advanceTimersByTime(1_000);
      expect(versions.stamped).toBe(3);

      for (const store of sharedStores()) {
        const value = await persistOf(store.key).getOptions().storage!.getItem(store.key);
        written.set(store.key, value);
        const read = store.read(JSON.stringify(value));
        expect(read?.clocks, store.key).toHaveProperty("written");
        expect(read?.fields, store.key).not.toHaveProperty(CLOCKS);
        expect(read?.fields, store.key).toEqual(store.persisted());
      }
    } finally {
      for (const stop of stops) stop();
    }
    reset();
    for (const store of sharedStores()) {
      const storage = persistOf(store.key).getOptions().storage!;
      storage.setItem(store.key, written.get(store.key) as never);
    }
    vi.advanceTimersByTime(1_000);
    vi.useRealTimers();
    for (const store of sharedStores()) {
      await persistOf(store.key).rehydrate();
      expect(store.getState(), store.key).not.toHaveProperty(CLOCKS);
    }
    expect(promptOf(mine)).toBe("typed here");
    expect(useRightPanelStore.getState().byThreadKey[scopedThreadKey(mine)]?.isOpen).toBe(true);
    expect(
      useTerminalUiStateStore.getState().terminalUiStateByThreadKey[scopedThreadKey(mine)]
        ?.terminalHeight,
    ).toBe(321);
  });

  it("start being shared as the app's first modules load, in the turn the stores read localStorage", () => {
    expect(mainSource).toMatch(/^import "\.\/stemcells\/windows\/startSharing";$/m);
  });

  it("writes its debounced stores on beforeunload, which a move sends", () => {
    expect(composerDraftStoreSource).toMatch(
      /addEventListener\("beforeunload", \(\) => \{\s*composerDebouncedStorage\.flush\(\);/,
    );
    expect(uiStateStoreSource).toMatch(
      /addEventListener\("beforeunload", \(\) => \{\s*debouncedPersistState\.flush\(\);/,
    );
  });
});
