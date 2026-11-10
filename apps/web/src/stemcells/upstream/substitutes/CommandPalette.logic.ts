// Replaces `components/CommandPalette.logic.ts` (`plugin.ts`): the no-project chat is a casual
// chat (`stemcells/words/casualChat.ts`), Copy thread is Copy Cell (`copyCell.ts`) and Open usage
// names the accounts listed there (`stemcells/accounts/`). Upstream
// builds both actions in hot `CommandPalette.tsx`; their words change here on the way through.
import { buildRootGroups as buildUpstreamRootGroups } from "../../../components/CommandPalette.logic";
import { CASUAL_CHAT } from "../../../../../../stemcells/words/casualChat.ts";
import { COPY_CELL } from "../../../../../../stemcells/words/copyCell.ts";

export * from "../../../components/CommandPalette.logic";

// Upstream's value for that action. Exported, it would be a name upstream's
// module lacks; `casualChat.contract.test.ts` pins it in upstream's palette.
const CASUAL_CHAT_ACTION = "action:new-thread-without-project";
// Upstream's copy action, titled for a Cell's pull request when it has one.
const COPY_ACTION = "action:copy-thread-reference";
// Upstream's Usage page, where our accounts list is: found by its words too.
const USAGE_ACTION = "action:usage";
const ACCOUNT_TERMS = ["accounts", "account", "sign in", "login", "plans"];

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
        : item.value === COPY_ACTION && item.title === "Copy thread"
          ? { ...item, title: COPY_CELL.action, searchTerms: [...item.searchTerms, "cell"] }
          : item.value === USAGE_ACTION
            ? {
                ...item,
                title: "Open usage and accounts",
                searchTerms: [...item.searchTerms, ...ACCOUNT_TERMS],
              }
            : item,
    ),
  });
}
