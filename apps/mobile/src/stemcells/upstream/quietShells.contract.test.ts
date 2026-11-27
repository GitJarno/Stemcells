import { PrimaryConnectionTarget } from "@t3tools/client-runtime/connection";
import { createEnvironmentThreadShellAtoms } from "@t3tools/client-runtime/state/threads";
import {
  EnvironmentId,
  RunId,
  type OrchestrationV2ShellSnapshot,
  type OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import { Atom, AtomRegistry } from "effect/reactivity";
import { expect, it } from "vite-plus/test";

import {
  v2ShellSnapshot,
  v2ThreadShell,
} from "../../../../../packages/client-runtime/src/state/orchestrationV2TestFixtures.ts";
import { quietShellsOf } from "./quietShells";

/**
 * Contract: what our layer reads of every chat (`cells.ts`) leans on T3's quiet shell staying the
 * same shell while its chat only streams, and on T3's full list still naming a chat a tag hides.
 */
const environmentId = EnvironmentId.make("environment-v2");

function harness(hidden: ReadonlyArray<string> | null) {
  const snapshotAtom = Atom.family((_environmentId: EnvironmentId) =>
    Atom.make<OrchestrationV2ShellSnapshot | null>(v2ShellSnapshot),
  );
  const threads = createEnvironmentThreadShellAtoms({
    catalogValueAtom: Atom.make({
      isReady: true,
      entries: new Map([
        [
          environmentId,
          {
            target: new PrimaryConnectionTarget({
              environmentId,
              label: "Environment",
              httpBaseUrl: "https://example.test",
              wsBaseUrl: "wss://example.test",
            }),
            profile: Option.none(),
            enabled: true,
          },
        ],
      ]),
    }),
    snapshotAtom,
    hiddenThreadTagsAtom: () => Atom.make(hidden),
  });
  const registry = AtomRegistry.make();
  const set = (thread: OrchestrationV2ThreadShell, sequence: number) =>
    registry.set(snapshotAtom(environmentId), {
      ...v2ShellSnapshot,
      snapshotSequence: sequence,
      threads: [thread],
    });
  return { registry, set, list: quietShellsOf(threads) };
}

const runId = RunId.make("streaming-run");
const running: OrchestrationV2ThreadShell = {
  ...v2ThreadShell,
  latestRunId: runId,
  activeRunId: runId,
  status: "running",
  itemCount: 1,
  visibleItemCount: 1,
};

it("is the same list while a chat streams, and a new one when the chat changes", () => {
  const { registry, set, list } = harness(null);
  set(running, 1);
  const dispose = registry.mount(list);
  try {
    const first = registry.get(list);
    expect(first.map((shell) => shell.id)).toEqual([v2ThreadShell.id]);
    set({ ...running, itemCount: 4, visibleItemCount: 3 }, 2);
    expect(registry.get(list)).toBe(first);
    set({ ...running, itemCount: 5, title: "Renamed" }, 3);
    expect(registry.get(list)).not.toBe(first);
    expect(registry.get(list)[0]?.title).toBe("Renamed");
  } finally {
    dispose();
    registry.dispose();
  }
});

it("still lists a chat a tag filter hides", () => {
  const { registry, set, list } = harness(["hidden"]);
  set({ ...running, tags: ["hidden"] } as OrchestrationV2ThreadShell, 1);
  try {
    expect(registry.get(list).map((shell) => shell.id)).toEqual([v2ThreadShell.id]);
  } finally {
    registry.dispose();
  }
});
