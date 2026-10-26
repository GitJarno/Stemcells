/**
 * Whether a Cell's line is down: its machine reconnecting or offline, or its
 * provider out, exactly while upstream's composer banner or provider banner
 * says so. A machine still connecting or reconnecting counts only once
 * upstream's grace for the warning has passed, as the banner waits.
 */
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";
import { resolveThreadProviderStack } from "@t3tools/client-runtime/state/models";

import { ENVIRONMENT_RECONNECT_WARNING_GRACE_MS } from "../../components/ChatView.logic";
import { getProviderStatusBannerKey } from "../../components/chat/ProviderStatusBanner";
import { useEnvironmentStateHeldFor } from "../../hooks/useEnvironmentDisconnectDelay";
import { useEnvironment, useEnvironmentProviders } from "../../state/environments";
import { useQuietThreadShell } from "../../state/entities";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/** Upstream's reconnect phases, which its banner holds back for a grace period. */
const reconnecting = (phase: EnvironmentConnectionPhase | null) =>
  phase === "connecting" || phase === "reconnecting";

/**
 * Down while the machine isn't connected (once the grace has passed, for a
 * reconnect), or while the provider has a status banner. A machine this
 * client doesn't know (`null`) says nothing.
 */
export function lineDownOf(
  phase: EnvironmentConnectionPhase | null,
  graceOver: boolean,
  providerBannerKey: string | null,
): boolean {
  if (phase !== null && phase !== "connected" && (!reconnecting(phase) || graceOver)) return true;
  return providerBannerKey !== null;
}

export function useCellLineDown(cell: CellRef | null): boolean {
  const ref = cell ? threadRefOf(cell) : null;
  const shell = useQuietThreadShell(ref);
  const environment = useEnvironment(ref?.environmentId ?? null);
  const providersByEnvironment = useEnvironmentProviders();
  const phase = environment?.connection.phase ?? null;
  // Each reconnect gets its own grace, as upstream's banner does.
  const graceOver = useEnvironmentStateHeldFor(
    reconnecting(phase) ? (ref?.environmentId ?? null) : null,
    ENVIRONMENT_RECONNECT_WARNING_GRACE_MS,
  );
  const instanceId = shell === null ? null : (resolveThreadProviderStack(shell).at(-1) ?? null);
  const provider =
    instanceId === null || ref === null
      ? null
      : (providersByEnvironment
          .get(ref.environmentId)
          ?.find((candidate) => candidate.instanceId === instanceId) ?? null);
  return lineDownOf(phase, graceOver, getProviderStatusBannerKey(provider));
}
