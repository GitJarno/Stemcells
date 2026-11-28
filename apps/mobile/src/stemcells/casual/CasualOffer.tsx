// "Have a casual chat" under a new chat's headline, the button the Mac has too
// (`apps/web/src/stemcells/casual/CasualButton.tsx`, `stemcells/seams.md`, A casual chat): it
// turns this draft into upstream's chat in no project, as the project list's row does, and the
// hero's "No project" picker leads back.

import { useState } from "react";
import { Pressable } from "react-native";

import { CASUAL_CHAT } from "../../../../../stemcells/words/casualChat.ts";
import {
  AppText,
  Dialog,
  availableScratchWorkspaceRoot,
  isAtomCommandInterrupted,
  newTaskFlowKey,
  projectEnvironment,
  readNewTaskFlowState,
  squashAtomCommandFailure,
  SymbolView,
  useAtomCommand,
  useIncomingShare,
  useNewTaskFlow,
  useRemoteConnectionStatus,
  useRoute,
  useServerConfigs,
} from "../upstream/casual";

export function CasualOffer(props: {
  readonly disabled: boolean;
  readonly incomingShareId: string | undefined;
}) {
  const flow = useNewTaskFlow();
  const serverConfigs = useServerConfigs();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const { getShare } = useIncomingShare();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, { reportFailure: false });
  const [starting, setStarting] = useState(false);
  const flowKey = newTaskFlowKey(useRoute());
  const pickedKey = () => (flowKey === undefined ? null : readNewTaskFlowState(flowKey).projectKey);

  const scratchEnvironments = connectedEnvironments.filter(
    (environment) =>
      availableScratchWorkspaceRoot(
        environment.connectionState,
        serverConfigs.get(environment.environmentId),
      ) !== null,
  );
  const scratchEnvironment =
    scratchEnvironments.find(
      (environment) => environment.environmentId === flow.selectedEnvironmentId,
    ) ??
    scratchEnvironments[0] ??
    null;
  // As the row: a share reserved for a project stays there.
  const reserved = props.incomingShareId
    ? Boolean(getShare(props.incomingShareId)?.destination)
    : false;
  if (flow.isScratchDraft || scratchEnvironment === null || reserved) return null;

  const start = async () => {
    const requested = pickedKey();
    setStarting(true);
    const result = await openScratch({
      environmentId: scratchEnvironment.environmentId,
      input: {},
    });
    setStarting(false);
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        Dialog.alert(
          "Could not start without a project",
          error instanceof Error
            ? error.message
            : "The folder for Cells without a project could not be created.",
        );
      }
      return;
    }
    // A pick made while the scratch project opened wins; the late result must not retarget it.
    if (pickedKey() !== requested) return;
    flow.setProject(result.value);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={CASUAL_CHAT.start}
      accessibilityHint="Makes this a chat in no project"
      disabled={props.disabled || starting}
      onPress={() => void start()}
      className="h-9 flex-row items-center gap-2 rounded-full bg-grouped-card px-4 active:opacity-65"
    >
      <SymbolView name="bubble.left" size={14} tintColorClassName="accent-icon-muted" />
      <AppText className="text-sm font-t3-medium text-foreground-secondary">
        {CASUAL_CHAT.start}
      </AppText>
    </Pressable>
  );
}
