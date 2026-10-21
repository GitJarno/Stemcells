/**
 * Aski's provider instance is Aski's alone. Its launch arguments carry Aski's
 * persona, so a Cell started there takes itself for Aski. The server refuses
 * it wherever upstream asks whether a thread may run on an instance: a thread
 * being started (t3_thread_launch, create_threads, delegate_task, a scheduled
 * run, a new chat's first message) and a message to any chat on it but
 * Aski's own. The refusal names the instances a Cell may use, so Aski, which
 * gets it as a tool error, starts the Cell again on one of them.
 */
import {
  ProviderInstanceId,
  resolveProjectProviderInstanceEnabled,
  type OrchestrationV2ThreadShellSnapshot,
  type ProjectId,
  type ServerSettings,
  type ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { ASKI_INSTANCE_ID, askiThreadOf } from "../needs/derive.ts";

type InstanceSettings = Pick<ServerSettings, "providerInstances" | "projectSettingsOverrides">;

/** The instances upstream enables before anything is configured (`isUnconfiguredDefaultInstanceEnabled`). */
export const DEFAULT_INSTANCES = ["codex", "claudeAgent"] as const;

/** The instances a Cell in the project may run on: every enabled one but Aski's. */
export function cellInstances(settings: InstanceSettings, projectId: ProjectId): string[] {
  const candidates = new Set<string>([
    ...DEFAULT_INSTANCES,
    ...Object.keys(settings.providerInstances),
  ]);
  return [...candidates].filter(
    (id) =>
      id !== ASKI_INSTANCE_ID &&
      resolveProjectProviderInstanceEnabled(settings, projectId, ProviderInstanceId.make(id)),
  );
}

/** What Aski reads when it starts a Cell on its own instance. */
export function askisInstanceRefusalText(usable: ReadonlyArray<string>): string {
  const own = `Provider instance "${ASKI_INSTANCE_ID}" is Aski's own, and no Cell runs on it.`;
  return usable.length === 0
    ? `${own} No other instance is enabled for this project.`
    : `${own} Start the Cell on one of these instead: ${usable.join(", ")}.`;
}

/**
 * Refuses a thread on Aski's instance, with `Refusal` (upstream's "instance
 * disabled" error, which every caller already hands back as it reads). Only
 * Aski's own chat runs there; a thread being started has no id yet, so it
 * never may. `shells` is read only for a message to a chat on Aski's
 * instance.
 */
export function refuseAskisInstance<E, R>(
  input: {
    readonly projectId: ProjectId;
    readonly instanceId: ProviderInstanceId;
    readonly threadId?: ThreadId | undefined;
  },
  settings: InstanceSettings,
  shells: Effect.Effect<OrchestrationV2ThreadShellSnapshot, E>,
  Refusal: new (props: {
    readonly projectId: ProjectId;
    readonly instanceId: ProviderInstanceId;
    readonly reason: string;
  }) => R,
): Effect.Effect<void, R> {
  if (input.instanceId !== ASKI_INSTANCE_ID) return Effect.void;
  const refusal = Effect.fail(
    new Refusal({
      projectId: input.projectId,
      instanceId: input.instanceId,
      reason: askisInstanceRefusalText(cellInstances(settings, input.projectId)),
    }),
  );
  const { threadId } = input;
  if (threadId === undefined) return refusal;
  return shells.pipe(
    Effect.orDie,
    Effect.flatMap((snapshot) =>
      askiThreadOf(snapshot.threads) === threadId ? Effect.void : refusal,
    ),
  );
}
