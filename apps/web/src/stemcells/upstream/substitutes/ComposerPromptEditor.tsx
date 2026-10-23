// Replaces `components/ComposerPromptEditor.tsx` (`plugin.ts`): the composer
// reads what is typed into a new chat and inks the words that set it up
// (`stemcells/words`), in Aski's chat, the words that answer its cards
// (`stemcells/needs/answers`), and in a finished Cell's chat, shows what the
// person would say next (`stemcells/suggestions`). Upstream's editor stays
// as it is; ours joins it.
import { ComposerPromptEditor as UpstreamComposerPromptEditor } from "../../../components/ComposerPromptEditor";
import type { ComposerPromptEditorProps } from "../../../components/ComposerPromptEditor";
import { cn } from "../../../lib/utils";
import { AskiAnswers } from "../../needs/answers/AskiAnswers";
import { useEditorSuggestion } from "../../suggestions/editor";
import { ComposerWords, useWordsAnchor } from "../../words/ComposerWords";

export * from "../../../components/ComposerPromptEditor";

export function ComposerPromptEditor(props: ComposerPromptEditorProps) {
  const anchor = useWordsAnchor();
  const suggesting = useEditorSuggestion(props);
  return (
    <>
      <UpstreamComposerPromptEditor {...suggesting.props} className={cn(props.className, anchor)} />
      {suggesting.ghost}
      <ComposerWords anchor={anchor} />
      <AskiAnswers anchor={anchor} />
    </>
  );
}
