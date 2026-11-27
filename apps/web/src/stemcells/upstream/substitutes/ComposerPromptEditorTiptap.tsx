// Replaces `components/ComposerPromptEditorTiptap.tsx` (`plugin.ts`): ours joins upstream's editor,
// inking the words that set up a new chat (`stemcells/words`) and, in Aski's chat, the words that
// answer its cards (`stemcells/needs/answers`) and a message that starts Cells becomes a plan
// (`stemcells/aski/plan`).
import { ComposerPromptEditorTiptap as UpstreamComposerPromptEditor } from "../../../components/ComposerPromptEditorTiptap";
import type { ComposerPromptEditorProps } from "../../../components/ComposerPromptEditorTiptap";
import { cn } from "../../../lib/utils";
import { AskiPlans } from "../../aski/plan/AskiPlans";
import { AskiAnswers } from "../../needs/answers/AskiAnswers";
import { ComposerWords, useWordsAnchor } from "../../words/ComposerWords";

export * from "../../../components/ComposerPromptEditorTiptap";

export function ComposerPromptEditorTiptap(props: ComposerPromptEditorProps) {
  const anchor = useWordsAnchor();
  return (
    <>
      <UpstreamComposerPromptEditor {...props} className={cn(props.className, anchor)} />
      <ComposerWords anchor={anchor} />
      <AskiAnswers anchor={anchor} />
      <AskiPlans anchor={anchor} />
    </>
  );
}
