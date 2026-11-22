/**
 * Which provider a chat runs on, as upstream's driver id, and the marks
 * upstream draws for the providers that have one.
 */
import { providerClients } from "@t3tools/client-runtime/provider-clients";
import type { ProviderIcon } from "@t3tools/provider-core/client";
import { resolveThreadProviderStack } from "@t3tools/client-runtime/state/models";
import type { ProviderDriverKind } from "@t3tools/contracts";
import type { ReactNode } from "react";

import { ClaudeAI, OpenAI } from "../../components/Icons";
import { cn } from "../../lib/utils";
import { useEnvironmentProviders } from "../../state/environments";
import { useQuietThreadShell } from "../../state/entities";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/**
 * The driver of the provider the chat runs on now (its running turn's, else
 * the one it last chose); null while it is an unsent draft. A provider this
 * client hasn't listed yet reads as its instance id, which for a provider's
 * default instance is its driver.
 */
export function useCellDriver(cell: CellRef | null): string | null {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const providersByEnvironment = useEnvironmentProviders();
  if (shell === null) return null;
  const instanceId = resolveThreadProviderStack(shell).at(-1) ?? null;
  if (instanceId === null) return null;
  const provider = providersByEnvironment
    .get(shell.environmentId)
    ?.find((candidate) => candidate.instanceId === instanceId);
  return provider?.driver ?? instanceId;
}

const MARK_BY_DRIVER = { claudeAgent: ClaudeAI, codex: OpenAI } as const;

// Upstream draws Antigravity's mark as a raster; this is its official vector from the ACP Registry.
const ANTIGRAVITY: Pick<ProviderIcon, "viewBox" | "paths"> = {
  viewBox: "0 0 16 16",
  paths: [
    {
      d: "M14.1452 14.6818C14.9937 15.3182 16.2664 14.894 15.0997 13.7273C11.5998 10.3333 12.3421 1 7.99366 1C3.64518 1 4.3876 10.3333 0.887603 13.7273C-0.385123 15 0.993664 15.3182 1.84215 14.6818C5.13002 12.4545 4.9179 8.5303 7.99366 8.5303C11.0694 8.5303 10.8573 12.4545 14.1452 14.6818Z",
    },
  ],
};

/** The vector mark for a provider without a bundled one: Antigravity's, else its package's. */
function vectorOf(driver: string): Pick<ProviderIcon, "viewBox" | "paths"> | null {
  if (driver === "antigravity") return ANTIGRAVITY;
  return providerClients.get(driver as ProviderDriverKind)?.icon ?? null;
}

/** Whether `ProviderLogo` draws a mark for this driver rather than its fallback. */
export function hasProviderLogo(driver: string): boolean {
  return driver in MARK_BY_DRIVER || vectorOf(driver) !== null;
}

/** Upstream's own mark for a provider, drawn in the current colour; `fallback` for one it draws none for. */
export function ProviderLogo(props: {
  readonly driver: string;
  readonly className?: string;
  readonly fallback?: ReactNode;
}) {
  const Mark = MARK_BY_DRIVER[props.driver as keyof typeof MARK_BY_DRIVER];
  // Upstream paints Claude's mark in its brand; the imprint wears the ink.
  if (Mark !== undefined)
    return <Mark className={cn("fill-current", props.className)} aria-hidden="true" />;
  const vector = vectorOf(props.driver);
  if (vector === null) return props.fallback ?? null;
  return (
    <svg
      viewBox={vector.viewBox}
      fill="currentColor"
      className={props.className}
      aria-hidden="true"
    >
      {vector.paths.map((path) => (
        // A detail a package paints in its own second colour reads as a lighter shade of the ink.
        <path
          key={path.d}
          d={path.d}
          fillRule={path.fillRule}
          opacity={path.fill ? 0.35 : undefined}
        />
      ))}
    </svg>
  );
}
