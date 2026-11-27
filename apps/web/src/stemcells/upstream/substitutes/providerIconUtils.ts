// Replaces `components/chat/providerIconUtils.ts` (`plugin.ts`): the helpers most views name a
// model with write it concisely; both are wrapped, as the trigger's calls the other inside its
// module. The composer's button names a current model by family alone ("Opus"), as the pick does.
import * as Upstream from "../../../components/chat/providerIconUtils";
import { pickName } from "../../models/lineup";
import { conciseModelName } from "../../models/names";

export * from "../../../components/chat/providerIconUtils";

export const getDisplayModelName: typeof Upstream.getDisplayModelName = (model, options) =>
  conciseModelName(Upstream.getDisplayModelName(model, options));

// From a name the rule reads, the provider's own or its short one: upstream's trigger form can
// drop the vendor ("3.8 Flash (High)"), which the rule can't read.
export const getTriggerDisplayModelName: typeof Upstream.getTriggerDisplayModelName = (
  model,
  driverKind,
) => {
  const read = [model.name, model.shortName].find(
    (name) => name !== undefined && conciseModelName(name) !== name,
  );
  return pickName({
    name: read ?? conciseModelName(Upstream.getTriggerDisplayModelName(model, driverKind)),
    isLegacy: model.isLegacy,
  });
};
