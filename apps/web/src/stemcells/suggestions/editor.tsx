import { type ReactNode, use, useId, useState } from "react";

import { type ComposerPromptEditorProps, IDLE_PLACEHOLDER } from "../upstream/suggestions";
import { cn } from "../upstream/ui";
import { SuggestionGhost } from "./SuggestionGhost";
import { PromptSuggestionContext } from "./usePromptSuggestion";

/**
 * The composer's editor with its chat's suggestion: shown in place of
 * upstream's idle hint, and only there, while nothing is typed. Tab or →
 * takes it, as in Claude Code, and so does a tap on its key; Esc hides it.
 * Taking it is an edit like typing it, so the composer's draft, cursor and
 * menus follow as they would.
 */
export function useEditorSuggestion(props: ComposerPromptEditorProps): {
  readonly props: ComposerPromptEditorProps;
  readonly ghost: ReactNode;
} {
  const suggestion = use(PromptSuggestionContext);
  const hostClass = `sc-suggest-${useId().replace(/[^\w-]/g, "")}`;
  // The ghost draws in the editor's own box, which upstream renders: a mark
  // beside the editor finds it once both are in the page.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const ghostWith = (drawn: ReactNode) => (
    <>
      <span
        hidden
        ref={(element) => {
          setHost(element === null ? null : document.querySelector<HTMLElement>(`.${hostClass}`));
        }}
      />
      {drawn}
    </>
  );

  const shown =
    suggestion !== null &&
    props.value.length === 0 &&
    props.contextRecords.size === 0 &&
    !props.disabled &&
    props.placeholder === IDLE_PLACEHOLDER
      ? suggestion
      : null;
  const withHost = { ...props, containerClassName: cn(props.containerClassName, hostClass) };
  if (shown === null) return { props: withHost, ghost: ghostWith(null) };

  const take = () => {
    props.onChange(shown.text, shown.text.length, shown.text.length, false, []);
    props.editorRef.current?.focusAtEnd();
  };
  const onCommandKeyDown: ComposerPromptEditorProps["onCommandKeyDown"] = (
    key,
    event,
    isTaskItem,
  ) => {
    const plain = !event.isComposing && !event.shiftKey && !event.altKey && !event.metaKey;
    // An open menu keeps its keys.
    if (plain && !event.ctrlKey && props.activeSuggestionId === undefined) {
      if (key === "Tab" || key === "ArrowRight") {
        take();
        return true;
      }
      if (key === "Escape") {
        shown.dismiss();
        return true;
      }
    }
    return props.onCommandKeyDown?.(key, event, isTaskItem) ?? false;
  };
  return {
    props: {
      ...withHost,
      // Screen readers read it as the placeholder; the ghost draws it.
      placeholder: shown.text,
      placeholderClassName: cn(props.placeholderClassName, "invisible"),
      onCommandKeyDown,
    },
    ghost: ghostWith(
      host === null ? null : (
        <SuggestionGhost
          host={host}
          text={shown.text}
          className={props.placeholderClassName}
          onTake={take}
        />
      ),
    ),
  };
}
