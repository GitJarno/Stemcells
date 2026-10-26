import type { DesktopUpdateActionResult, DesktopUpdateState } from "@t3tools/contracts";

import {
  getDesktopUpdateActionError,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateInstallConfirmationMessage,
  resolveDesktopUpdateButtonAction,
} from "../../components/desktopUpdate.logic";
import { showDesktopUpdateDownloadedToast } from "../../components/desktopUpdate.toast";
import { SidebarUpdateReleaseNotes } from "../../components/sidebar/SidebarUpdateReleaseNotes";
import type {
  SkippedMachine,
  collectServerUpdateTargets,
} from "../../components/sidebar/updateEverything.logic";
import { stackedThreadToast, toastManager } from "../../components/ui/toast";
import { ensureLocalApi } from "../../localApi";

export { useDesktopUpdateState } from "../../state/desktopUpdate";
export type { DesktopUpdateState };

type ServerUpdateTarget = ReturnType<typeof collectServerUpdateTargets>["targets"][number];

// What Update Everything offers. Stemcells offers a server update only to a server its own app
// runs, which updates with the app. Any other server updates by downloading T3's build, which
// Stemcells never offers, so it never asks npm for T3's version either; those are listed skipped.

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

/**
 * Where the app's own update stands, as upstream's pill reads it: one to
 * download (or a failed download to retry), one downloading, one built and
 * waiting for a restart. Null when there is none to take.
 */
export type UpdateStep = "download" | "downloading" | "restart";

export function updateStep(state: DesktopUpdateState): UpdateStep | null {
  if (state.status === "downloading") return "downloading";
  const action = resolveDesktopUpdateButtonAction(state);
  return action === "download" ? "download" : action === "install" ? "restart" : null;
}

/**
 * Upstream's notes, as its pill's popover draws them: each nightly's pull
 * requests by title, its links through our `desktopUpdate.logic`, under
 * upstream's own line for where the update stands.
 */
export function UpdateNotes(props: { state: DesktopUpdateState }) {
  return (
    <SidebarUpdateReleaseNotes
      shell={window.desktopBridge}
      state={props.state}
      tooltip={getDesktopUpdateButtonTooltip(props.state)}
    />
  );
}

// Upstream's pill keeps its download and install to itself, so these do as
// it does: the same bridge calls, toast and confirmation, in its words.

const toastError = (title: string, description: string) => {
  toastManager.add(stackedThreadToast({ type: "error", title, description }));
};
const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const toastResultError = (title: string, result: DesktopUpdateActionResult) => {
  const error = getDesktopUpdateActionError(result);
  if (error) toastError(title, error);
};

/** Gets the update ready; a toast says when it is, or why not. */
export async function downloadUpdate(): Promise<void> {
  const bridge = window.desktopBridge;
  if (!bridge) return;
  try {
    const result = await bridge.downloadUpdate();
    if (result.completed) showDesktopUpdateDownloadedToast(bridge, result.state);
    toastResultError("Could not download update", result);
  } catch (error) {
    toastError(
      "Could not start update download",
      messageOf(error, "An unexpected error occurred."),
    );
  }
}

/** Asks first, as every running turn ends with the restart, then restarts into the update. */
export async function restartToUpdate(state: DesktopUpdateState): Promise<void> {
  const bridge = window.desktopBridge;
  if (!bridge) return;
  let confirmed = false;
  try {
    confirmed = await ensureLocalApi().dialogs.confirm(
      getDesktopUpdateInstallConfirmationMessage(state),
    );
  } catch (error) {
    toastError("Could not confirm update", messageOf(error, "Update confirmation failed."));
    return;
  }
  if (!confirmed) return;
  try {
    const result = await bridge.installUpdate();
    if (!result.accepted) {
      showDesktopUpdateDownloadedToast(bridge, result.state);
      return;
    }
    toastResultError("Could not install update", result);
  } catch (error) {
    toastError("Could not install update", messageOf(error, "An unexpected error occurred."));
  }
}
