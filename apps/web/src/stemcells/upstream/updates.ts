import type {
  SkippedMachine,
  collectServerUpdateTargets,
} from "../../components/sidebar/updateEverything.logic";

type ServerUpdateTarget = ReturnType<typeof collectServerUpdateTargets>["targets"][number];

// What Update Everything offers to update. Stemcells offers a server update
// only to a server its own app runs, which updates with the app. Any other
// server updates itself by downloading T3's build (t3 from npm, or T3's
// releases), and Stemcells never offers that, so it never asks npm whether
// T3 published a version either. Those servers are listed as skipped.

export function offeredServerUpdates(
  behind: ReadonlyArray<ServerUpdateTarget>,
  unreachable: ReadonlyArray<SkippedMachine>,
): { readonly servers: ServerUpdateTarget[]; readonly skipped: SkippedMachine[] } {
  const ours = (server: ServerUpdateTarget) => server.selfUpdate === "desktop-managed";
  return {
    servers: behind.filter(ours),
    skipped: [
      ...unreachable,
      ...behind
        .filter((server) => !ours(server))
        .map((server) => ({
          environmentId: server.environmentId,
          label: server.serverLabel,
          reason: "needs a manual update",
        })),
    ],
  };
}
