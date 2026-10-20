/**
 * Which provider a chat runs on, as upstream's driver id, and the marks
 * upstream draws for the providers that have one.
 */
import { resolveThreadProviderStack } from "@t3tools/client-runtime/state/models";
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

/** Upstream's own mark for a provider, drawn in the current colour; `fallback` for one it draws none for. */
export function ProviderLogo(props: {
  readonly driver: string;
  readonly className?: string;
  readonly fallback?: ReactNode;
}) {
  const Mark = MARK_BY_DRIVER[props.driver as keyof typeof MARK_BY_DRIVER];
  if (Mark === undefined) return props.fallback ?? null;
  // Upstream paints Claude's mark in its brand; the imprint wears the ink.
  return <Mark className={cn("fill-current", props.className)} aria-hidden="true" />;
}
