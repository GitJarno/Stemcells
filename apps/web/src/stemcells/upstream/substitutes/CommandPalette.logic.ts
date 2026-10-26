// Replaces `components/CommandPalette.logic.ts` (`plugin.ts`): the palette's no-project chat
// action is a casual chat (`stemcells/words/casualChat.ts`), found by its words too. Upstream
// builds it in `CommandPalette.tsx`, a hot file, and hands it to `buildRootGroups` here, so the
// words change on the way through and that file stays upstream's.
import { buildRootGroups as buildUpstreamRootGroups } from "../../../components/CommandPalette.logic";
import { CASUAL_CHAT } from "../../../../../../stemcells/words/casualChat.ts";

export * from "../../../components/CommandPalette.logic";

// Upstream's value for that action. Exported, it would be a name upstream's
// module lacks; `casualChat.contract.test.ts` pins it in upstream's palette.
const CASUAL_CHAT_ACTION = "action:new-thread-without-project";

export function buildRootGroups(
  input: Parameters<typeof buildUpstreamRootGroups>[0],
): ReturnType<typeof buildUpstreamRootGroups> {
  return buildUpstreamRootGroups({
    ...input,
    actionItems: input.actionItems.map((item) =>
      item.value === CASUAL_CHAT_ACTION
        ? {
            ...item,
            title: CASUAL_CHAT.action,
            searchTerms: [...item.searchTerms, ...CASUAL_CHAT.searchTerms],
          }
        : item,
    ),
  });
}
