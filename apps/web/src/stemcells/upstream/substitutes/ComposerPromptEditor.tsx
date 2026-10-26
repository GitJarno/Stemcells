// Replaces `components/ComposerPromptEditor.tsx` (`plugin.ts`): ours joins upstream's editor,
// inking the words that set up a new chat (`stemcells/words`), in Aski's chat the words that
// answer its cards (`stemcells/needs/answers`), and in a finished Cell's chat showing what the
// person would say next (`stemcells/suggestions`).
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
