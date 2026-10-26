/**
 * Aski's provider instance is Aski's alone: its launch arguments carry Aski's persona, so a
 * Cell started there takes itself for Aski. Any thread start there is refused, naming the
 * instances a Cell may use, so Aski starts it again on one. A message to another chat already
 * there runs on the driver's own instance (`apps/web/src/stemcells/upstream/cellInstance.ts`).
 */
import {
  defaultInstanceIdForDriver,
  ProviderInstanceId,
  resolveProjectProviderInstanceEnabled,
  type ModelSelection,
  type OrchestrationV2ServerCommand,
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
 * Refuses a thread being started on Aski's instance, with `Refusal`
 * (upstream's "instance disabled" error, which every caller already hands
 * back as it reads). A message names its thread: it reaches Aski's instance
 * only in Aski's own chat, since `moveCellsOffAskisInstance` moves any other.
 */
export function refuseAskisInstance<R>(
  input: {
    readonly projectId: ProjectId;
    readonly instanceId: ProviderInstanceId;
    readonly threadId?: ThreadId | undefined;
  },
  settings: InstanceSettings,
  Refusal: new (props: {
    readonly projectId: ProjectId;
    readonly instanceId: ProviderInstanceId;
    readonly reason: string;
  }) => R,
): Effect.Effect<void, R> {
  if (input.instanceId !== ASKI_INSTANCE_ID || input.threadId !== undefined) return Effect.void;
  return Effect.fail(
    new Refusal({
      projectId: input.projectId,
      instanceId: input.instanceId,
      reason: askisInstanceRefusalText(cellInstances(settings, input.projectId)),
    }),
  );
}

/** Where a message to a Cell's chat on Aski's instance runs: the same model on the driver's own. */
export function cellSelection(
  selection: ModelSelection,
  settings: Pick<ServerSettings, "providerInstances">,
): ModelSelection {
  const askis = settings.providerInstances[ProviderInstanceId.make(ASKI_INSTANCE_ID)];
  return askis === undefined
    ? selection
    : { ...selection, instanceId: defaultInstanceIdForDriver(askis.driver) };
}

/**
 * Moves a message to a chat on Aski's instance that isn't Aski's own (a Cell
 * made there before Cells were kept off it) to the driver's own instance.
 * Every other command passes as it is. The chat is read only for a message
 * that names no model, and the shells only for one on Aski's instance.
 */
export function moveCellsOffAskisInstance<E, S>(read: {
  readonly thread: (
    threadId: ThreadId,
  ) => Effect.Effect<{ readonly thread: { readonly modelSelection: ModelSelection } }, E>;
  readonly settings: Effect.Effect<Pick<ServerSettings, "providerInstances">>;
  readonly shells: () => Effect.Effect<OrchestrationV2ThreadShellSnapshot, S>;
}) {
  return (
    command: OrchestrationV2ServerCommand,
  ): Effect.Effect<OrchestrationV2ServerCommand, E> => {
    if (command.type !== "message.dispatch") return Effect.succeed(command);
    const selection =
      command.modelSelection === undefined
        ? read.thread(command.threadId).pipe(Effect.map(({ thread }) => thread.modelSelection))
        : Effect.succeed(command.modelSelection);
    return selection.pipe(
      Effect.flatMap((selection) =>
        selection.instanceId !== ASKI_INSTANCE_ID
          ? Effect.succeed(command)
          : Effect.all([read.shells().pipe(Effect.orDie), read.settings]).pipe(
              Effect.map(([snapshot, settings]) =>
                askiThreadOf(snapshot.threads) === command.threadId
                  ? command
                  : { ...command, modelSelection: cellSelection(selection, settings) },
              ),
            ),
      ),
    );
  };
}
