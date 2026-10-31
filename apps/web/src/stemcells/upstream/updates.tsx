import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { PROVIDER_DISPLAY_NAMES, type DesktopUpdateState } from "@t3tools/contracts";

import { resolveDesktopUpdateButtonAction } from "../../components/desktopUpdate.logic";
import { openDesktopUpdateReleaseNotes } from "../../components/desktopUpdate.toast";
import {
  collectProviderUpdateCandidates,
  hasOneClickUpdateProviderCandidate,
  isProviderUpdateActive,
} from "../../components/ProviderUpdateLaunchNotification.logic";
import { useProviderUpdates } from "../../components/ProviderUpdatesAction";
import type {
  SkippedMachine,
  collectServerUpdateTargets,
} from "../../components/sidebar/updateEverything.logic";
import { stackedThreadToast, toastManager } from "../../components/ui/toast";

import {
  useEnvironmentProviders,
  useEnvironments,
  usePrimaryEnvironmentId,
} from "../../state/environments";
import type { ProviderOffer, ProviderRunResult } from "../updates/providers";

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

// Upstream's pill keeps its download and install to itself, so these make the
// same bridge calls. The column says where the update stands (UpdateBanner.tsx),
// so neither shows upstream's toast or its confirmation.

const toastError = (title: string, error: unknown) => {
  const description = error instanceof Error ? error.message : "An unexpected error occurred.";
  toastManager.add(stackedThreadToast({ type: "error", title, description }));
};

/** Gets the update ready; its state says how far, or why not. True once it is. */
export async function downloadUpdate(): Promise<boolean> {
  try {
    const result = await window.desktopBridge?.downloadUpdate();
    return result?.completed === true;
  } catch (error) {
    toastError("Couldn't update", error);
    return false;
  }
}

/** Restarts into the update that's ready. True once the app is on its way out. */
export async function installUpdate(): Promise<boolean> {
  try {
    const result = await window.desktopBridge?.installUpdate();
    return result?.accepted === true && result.state.status !== "error";
  } catch (error) {
    toastError("Couldn't update", error);
    return false;
  }
}

const REPOSITORY = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u;

/**
 * A pull request on the repository the app updates from, which `install-app` builds in. None
 * without one: upstream's fallback is T3's repository, where our numbers mean something else.
 */
export function pullRequestUrl(
  number: number,
  repository: string | undefined = import.meta.env.T3CODE_DESKTOP_UPDATE_REPOSITORY,
): string | null {
  const name = repository?.trim() ?? "";
  return REPOSITORY.test(name) ? `https://github.com/${name}/pull/${number}` : null;
}

/** Opens a link in the person's browser, as upstream's notes do. */
export function openLink(url: string): void {
  void openDesktopUpdateReleaseNotes(window.desktopBridge, url);
}

/**
 * The providers Update Everything would update, on every connected machine: upstream's own
 * candidates (enabled, behind what their installer would install, one command for all their
 * instances), with one already updating kept so the banner can say so.
 */
export function useProviderOffers(): ReadonlyArray<ProviderOffer> {
  const { environments } = useEnvironments();
  const providersByEnvironment = useEnvironmentProviders();
  const primary = usePrimaryEnvironmentId();
  return environments.flatMap((environment) => {
    if (environment.connection.phase !== "connected") return [];
    const providers = providersByEnvironment.get(environment.environmentId) ?? [];
    return collectProviderUpdateCandidates(providers)
      .filter((candidate) => hasOneClickUpdateProviderCandidate(candidate, providers))
      .map((candidate): ProviderOffer => {
        const state = candidate.updateState;
        const failed = state?.status === "failed" || state?.status === "unchanged";
        return {
          key: `${environment.environmentId}:${candidate.instanceId}`,
          name: PROVIDER_DISPLAY_NAMES[candidate.driver] ?? candidate.driver,
          machine: environment.environmentId === primary ? null : environment.label,
          from: candidate.versionAdvisory.currentVersion,
          to: candidate.versionAdvisory.latestVersion,
          updating: isProviderUpdateActive(candidate),
          failure: failed ? (state.message ?? "The update didn't take.") : null,
        };
      });
  });
}

/** Updates every offered provider that isn't already updating, without upstream's toast. */
export function useUpdateProviders(): () => Promise<ReadonlyArray<ProviderRunResult>> {
  const { updateAll } = useProviderUpdates();
  return async () =>
    (await updateAll({ quiet: true })).map(({ environmentId, instanceId, result }) => {
      const key = `${environmentId}:${instanceId}`;
      if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) {
        return { key, failure: null };
      }
      const error = squashAtomCommandFailure(result);
      return { key, failure: error instanceof Error ? error.message : "The update didn't start." };
    });
}
