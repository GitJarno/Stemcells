import type { ScopedThreadRef } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { settleFromAnyStage } from "./settle";

const cell = vi.hoisted(() => {
  const state = {
    shell: null as { source: { status: string; pendingRuntimeRequest: unknown } } | null,
    stops: true,
    sent: [] as string[],
  };
  return {
    state,
    setup: (status: string, stops = true) => {
      state.shell = { source: { status, pendingRuntimeRequest: null } };
      state.stops = stops;
      state.sent = [];
    },
  };
});

vi.mock("~/state/entities", () => ({ readThreadShell: () => cell.state.shell }));
vi.mock("~/state/threads", () => ({
  threadEnvironment: { interruptTurn: "interruptTurn" },
  environmentThreadShells: { threadShellAtom: () => "shell" },
}));
vi.mock("~/rpc/atomRegistry", () => ({ appAtomRegistry: {} }));
vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  runAtomCommand: async (_registry: unknown, command: string) => {
    cell.state.sent.push(command);
    return { _tag: "Success" };
  },
}));
vi.mock("~/state/waitForAtomValue", () => ({
  waitForAtomValue: async () => {
    if (cell.state.stops) {
      cell.state.shell = { source: { status: "interrupted", pendingRuntimeRequest: null } };
    }
    return cell.state.stops;
  },
}));
vi.mock("~/components/ui/toast", () => ({
  stackedThreadToast: (toast: unknown) => toast,
  toastManager: { add: () => cell.state.sent.push("toast") },
}));
vi.mock("./substitutes/useThreadActions", () => ({ useThreadActions: () => ({}) }));

const ref = { environmentId: "env", threadId: "otter" } as unknown as ScopedThreadRef;
const settleThread = async () => {
  cell.state.sent.push("settle");
  return { _tag: "Success" } as const;
};

describe("settling a Cell from any stage", () => {
  it("settles a landed Cell straight away", async () => {
    cell.setup("completed");
    expect(await settleFromAnyStage(ref, settleThread as never)).toBe(true);
    expect(cell.state.sent).toEqual(["settle"]);
  });

  it("stops a Cell at work, and settles it once its run has ended", async () => {
    cell.setup("running");
    expect(await settleFromAnyStage(ref, settleThread as never)).toBe(true);
    expect(cell.state.sent).toEqual(["interruptTurn", "settle"]);
  });

  it("leaves it unsettled, and says so, when it doesn't stop", async () => {
    cell.setup("waiting", false);
    expect(await settleFromAnyStage(ref, settleThread as never)).toBe(false);
    expect(cell.state.sent).toEqual(["interruptTurn", "toast"]);
  });
});
