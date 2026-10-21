import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { runsOnOf } from "./chatHeader";

const here = EnvironmentId.make("environment-here");
const away = EnvironmentId.make("environment-away");
const thisMac = {
  environmentId: here,
  projectId: null,
  label: "This device",
  isPrimary: true,
  machine: "laptop",
} as const;
const server = {
  environmentId: away,
  projectId: null,
  label: "Build box",
  isPrimary: false,
  machine: "server",
} as const;

describe("where the line says a Cell runs", () => {
  it("says nothing for the project's own checkout on the only machine it is on", () => {
    expect(
      runsOnOf({ environmentId: here, worktreePath: null, branch: "main" }, [thisMac]),
    ).toBeNull();
  });

  it("names a worktree in upstream's words, with its branch", () => {
    expect(
      runsOnOf({ environmentId: here, worktreePath: "/work/tree", branch: "fix-leaves" }, [
        thisMac,
      ]),
    ).toEqual({ machine: null, worktree: { label: "Worktree", branch: "fix-leaves" } });
  });

  it("names another machine, as upstream's strip would", () => {
    expect(runsOnOf({ environmentId: away, worktreePath: null, branch: null }, [server])).toEqual({
      machine: { kind: "server", label: "Build box" },
      worktree: null,
    });
  });

  it("names this machine too when the project is on several", () => {
    expect(
      runsOnOf({ environmentId: here, worktreePath: null, branch: null }, [thisMac, server])
        ?.machine,
    ).toEqual({ kind: "laptop", label: "This device" });
  });
});
