// What the new chat's casual offer takes from upstream: the draft's flow, the command that opens
// a machine's scratch project, and how the project list's own row reads its result
// (`NewTaskRouteScreen.tsx`'s `startScratch`), so the offer and the row are one path.

export { availableScratchWorkspaceRoot } from "@t3tools/client-runtime/operations/projects";
export {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
export * as Dialog from "../../components/ui/Dialog";
export { AppText } from "../../components/ui/AppText";
export { useServerConfigs } from "../../state/entities";
export { projectEnvironment } from "../../state/projects";
export { useAtomCommand } from "../../state/use-atom-command";
export { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
export { useIncomingShare } from "../../features/sharing/IncomingShareProvider";
export { useNewTaskFlow } from "../../features/threads/new-task-flow-provider";
export { newTaskFlowKey, readNewTaskFlowState } from "../../features/threads/new-task-flow-state";
export { useRoute } from "@react-navigation/native";
