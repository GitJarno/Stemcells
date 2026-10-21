// Replaces `components/ComposerPromptEditor.tsx` (`plugin.ts`): the composer
// reads what is typed into a new chat and inks the words that set it up
// (`stemcells/words`), and in Aski's chat, the words that answer its cards
// (`stemcells/needs/answers`). Upstream's editor stays as it is; ours joins it.
import { ComposerPromptEditor as UpstreamComposerPromptEditor } from "../../../components/ComposerPromptEditor";
import type { ComposerPromptEditorProps } from "../../../components/ComposerPromptEditor";
import { cn } from "../../../lib/utils";
import { AskiAnswers } from "../../needs/answers/AskiAnswers";
import { ComposerWords, useWordsAnchor } from "../../words/ComposerWords";

export * from "../../../components/ComposerPromptEditor";

export function ComposerPromptEditor(props: ComposerPromptEditorProps) {
  const anchor = useWordsAnchor();
  return (
    <>
      <UpstreamComposerPromptEditor {...props} className={cn(props.className, anchor)} />
      <ComposerWords anchor={anchor} />
      <AskiAnswers anchor={anchor} />
    </>
  );
}
