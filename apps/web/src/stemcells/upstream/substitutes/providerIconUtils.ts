// Replaces `components/chat/providerIconUtils.ts` (`plugin.ts`): the helpers
// most views name a model with write it concisely. Both are wrapped, since
// upstream's trigger name calls `getDisplayModelName` inside its module.
import * as Upstream from "../../../components/chat/providerIconUtils";
import { conciseModelName } from "../../models/names";

export * from "../../../components/chat/providerIconUtils";

export const getDisplayModelName: typeof Upstream.getDisplayModelName = (model, options) =>
  conciseModelName(Upstream.getDisplayModelName(model, options));

export const getTriggerDisplayModelName: typeof Upstream.getTriggerDisplayModelName = (
  model,
  driverKind,
) => conciseModelName(Upstream.getTriggerDisplayModelName(model, driverKind));
