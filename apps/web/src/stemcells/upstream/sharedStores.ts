/**
 * Upstream's stores that keep one localStorage entry for the app but hold something per chat:
 * drafts, the right panel and the terminal drawer. With several windows, each merges the
 * others' writes into its own copy by each write's versions (`windows/storageMerge.ts`), through
 * zustand's persist options here. `sharedStores.contract.test.ts` pins what this relies on.
 */
import type { StoreApi } from "zustand";
import type { PersistStorage, StorageValue } from "zustand/middleware";

import { partializeComposerDraftStoreState, useComposerDraftStore } from "../../composerDraftStore";
import { useRightPanelStore } from "../../rightPanelStore";
import { useTerminalUiStateStore } from "../../terminalUiStateStore";
import type { Clocks, Written } from "../windows/storageMerge";

type Fields = Readonly<Record<string, unknown>>;

/** Where a write carries its versions: beside the state, or (drafts) in it. */
export const CLOCKS = "stemcells:clocks";

export interface SharedStore {
  /** Its localStorage key. */
  readonly key: string;
  /** What this window would write for `state` (now, by default). */
  readonly persisted: (state?: object) => Fields;
  /** A write, as the store would hydrate it over this window's state. */
  readonly hydrate: (persisted: Fields) => object;
  readonly getState: () => object;
  /** Sets state as the store's own actions do, so the store writes it in turn. */
  readonly setState: (state: object) => void;
  /** A write's fields and the versions it carries; nothing for what isn't one. */
  readonly read: (raw: string | null) => Written | null;
  /**
   * Has each write carry `clocks(fields)`, worked out as it is written (the
   * drafts' writes wait a moment); returns the way to stop.
   */
  readonly carry: (clocks: (fields: Fields) => Clocks) => () => void;
}

/** What the merge reads of a zustand store with `persist`, writing `P`. */
interface PersistedStore<S, P> extends StoreApi<S> {
  readonly persist: {
    readonly getOptions: () => {
      readonly name?: string | undefined;
      readonly partialize?: ((state: S) => P) | undefined;
      readonly merge?: ((persisted: unknown, current: S) => S) | undefined;
      readonly storage?: PersistStorage<P> | undefined;
    };
    readonly setOptions: (options: { readonly storage: PersistStorage<P> }) => void;
  };
}

function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface Shape<S> {
  /** What the store writes for a state, if not its own `partialize`. */
  readonly persisted?: (state: S) => Fields;
  /**
   * The fields a write's `state` stands for, worked out only as it is
   * written. Set for a store whose storage writes `state` itself and
   * nothing beside it, so its versions go in it.
   */
  readonly fieldsOfWrite?: (state: unknown) => Fields;
}

function shared<S, P>(store: PersistedStore<S, P>, shape: Shape<S> = {}): SharedStore {
  const options = store.persist.getOptions();
  const persisted =
    shape.persisted ??
    (options.partialize as ((state: S) => Fields) | undefined) ??
    ((state: S) => state as Fields);
  const inState = shape.fieldsOfWrite !== undefined;
  return {
    key: options.name!,
    persisted: (state) => persisted((state as S | undefined) ?? store.getState()),
    hydrate: (fields) =>
      options.merge
        ? (options.merge(fields, store.getState()) as object)
        : { ...store.getState(), ...fields },
    getState: () => store.getState() as object,
    setState: (state) => store.setState(state as S),
    read: (raw) => {
      let value: unknown;
      try {
        value = raw === null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
      if (!isRecord(value) || !isRecord(value.state)) return null;
      if (!inState) return { fields: value.state, clocks: (value[CLOCKS] ?? {}) as Clocks };
      const { [CLOCKS]: clocks = {}, ...fields } = value.state;
      return { fields, clocks: clocks as Clocks };
    },
    carry: (clocks) => {
      const storage = store.persist.getOptions().storage!;
      const fieldsOfWrite = shape.fieldsOfWrite;
      // Both are written as JSON: the drafts' `state` stands for its fields and versions.
      const setItem = fieldsOfWrite
        ? (name: string, value: StorageValue<P>) => {
            const state = {
              toJSON: () => {
                const fields = fieldsOfWrite(value.state);
                return { ...fields, [CLOCKS]: clocks(fields) };
              },
            };
            return storage.setItem(name, { ...value, state: state as P });
          }
        : (name: string, value: StorageValue<P>) => {
            const carried: StorageValue<P> & { [CLOCKS]?: Clocks } = {
              ...value,
              [CLOCKS]: clocks(value.state as Fields),
            };
            return storage.setItem(name, carried);
          };
      store.persist.setOptions({ storage: { ...storage, setItem } });
      return () => store.persist.setOptions({ storage });
    },
  };
}

/** The stores to keep in step across windows. */
export function sharedStores(): SharedStore[] {
  return [
    shared(useComposerDraftStore, {
      persisted: (state) => partializeComposerDraftStoreState(state) as Fields,
      // Upstream's drafts storage writes a state it captured, made into
      // fields as it writes (debounced), and any other state as it is.
      fieldsOfWrite: (state) =>
        (isRecord(state) && "capturedState" in state
          ? partializeComposerDraftStoreState(
              state.capturedState as Parameters<typeof partializeComposerDraftStoreState>[0],
            )
          : state) as Fields,
    }),
    shared(useRightPanelStore),
    shared(useTerminalUiStateStore),
  ];
}

/**
 * Has upstream's debounced stores (drafts, UI state) write now. They write
 * on `beforeunload`, and a move between windows makes them write first, so
 * the window a chat goes to reads what was typed in it a moment before.
 */
export function flushStoreWrites(): void {
  window.dispatchEvent(new Event("beforeunload"));
}
