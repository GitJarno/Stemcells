import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { startOpeningEnvironmentThread } from "./opening";
import { openOnPressIn } from "../home/opening";

const loads = vi.hoisted(() => [] as string[]);

// As upstream's own test of `startOpeningEnvironmentThread` (`state/threads.test.ts`): a thread's
// state loads where this family makes it, with no connection behind it.
vi.mock("../../connection/runtime", () => ({ connectionAtomRuntime: {} }));
vi.mock("../../connection/catalog", () => ({ environmentCatalog: {} }));
vi.mock("../../state/shell", () => ({ environmentShell: {} }));
vi.mock("./substitutes/threads", async (importOriginal) => {
  const { Atom } = await import("effect/reactivity");
  const stateAtom = Atom.family((key: string) =>
    Atom.make(() => {
      loads.push(key);
      return null;
    }),
  );
  return {
    ...(await importOriginal<object>()),
    createThreadFamilyAtoms: () => ({}),
    createOlderSettledThreadAtoms: () => ({}),
    createThreadEnvironmentAtoms: () => ({}),
    createEnvironmentThreadDetailAtoms: () => ({}),
    createEnvironmentThreadShellAtoms: () => ({}),
    createEnvironmentThreadStateAtoms: () => ({
      stateAtom: (environmentId: string, threadId: string) =>
        stateAtom(`${environmentId}:${threadId}`),
    }),
  };
});

const thread = {
  environmentId: EnvironmentId.make("environment-1"),
  id: ThreadId.make("thread-1"),
};

/** A Cell's row loads its chat as the finger lands, and the press after it (`home/opening.ts`). */
describe("a row's chat loading from press-in", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    loads.length = 0;
  });

  it("loads the chat once across the press-in and the press that opens it", () => {
    openOnPressIn(thread);
    expect(loads).toEqual(["environment-1:thread-1"]);
    startOpeningEnvironmentThread(thread.environmentId, thread.id);
    expect(loads).toEqual(["environment-1:thread-1"]);
  });
});
