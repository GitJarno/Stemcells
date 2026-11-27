// What starting a plan's Cell takes from upstream (stemcells/tasks/aski-orchestrator.md,
// decision 5), from modules Node can load: the input the phone's own new chat sends to start a
// thread with its first message, and the types of a model and the modes it runs in.

export {
  buildProjectThreadStartTurnInput,
  type ProjectThreadStartTurnSpec,
} from "../../lib/projectThreadStartTurn";
export {
  DEFAULT_PROVIDER_INTERACTION_MODE,
  type ModelSelection,
  ProjectId,
  ProviderInstanceId,
  type ProviderInteractionMode,
  type RuntimeMode,
} from "@t3tools/contracts";
export { createModelSelection } from "@t3tools/shared/model";
