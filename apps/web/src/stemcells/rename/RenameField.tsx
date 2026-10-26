import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from "react";

import { cn, Tooltip, TooltipPopup } from "../upstream/ui";
import { lastActedAt } from "./acts";
import { NAME_MAX_LENGTH } from "./limits";

/**
 * A name open for a new one where it stood: Enter or leaving keeps it, Escape doesn't, as in
 * upstream's header. It fills the name's room, so nothing around it moves. A name that can't be
 * applied (`onCommit` says why, e.g. its chat isn't loaded here) keeps the field open with what
 * was typed, the reason under it until it changes.
 */
/**
 * A focus taken this soon after the field opens, before the person pressed or typed anything,
 * is the app's (a double-clicked tab focusing its composer, upstream's ChatView): the field
 * takes it back. Any key or press of theirs ends that, keeping the name as it stands.
 */
const APP_FOCUS_WINDOW_MS = 500;

export function RenameField(props: {
  value: string;
  /** What a screen reader calls the field. */
  label: string;
  className?: string;
  /** Words back: it couldn't be applied, why, and the field stays. */
  onCommit: (value: string) => string | void;
  onCancel: () => void;
}) {
  const settled = useRef(false);
  const opened = useRef(Number.POSITIVE_INFINITY);
  const selected = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const noteId = useId();
  // oxlint-disable-next-line t3code/react-effect-budget -- Stamp when the field opened, to tell the app's focus grabs from the person's.
  useLayoutEffect(() => {
    opened.current = performance.now();
  }, []);
  /** Whether a focus leaving now is the app's: the field is new, and the person hasn't acted since. */
  const appTakes = () =>
    lastActedAt() < opened.current && performance.now() - opened.current < APP_FOCUS_WINDOW_MS;
  const commit = (value: string) => {
    const why = props.onCommit(value);
    settled.current = typeof why !== "string";
    setRefused(typeof why === "string" ? why : null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      settled.current = true;
      props.onCancel();
    }
  };
  return (
    <>
      <input
        ref={field}
        autoFocus
        maxLength={NAME_MAX_LENGTH}
        aria-label={props.label}
        aria-invalid={refused !== null || undefined}
        aria-describedby={refused !== null ? noteId : undefined}
        onInput={() => setRefused(null)}
        className={cn(
          "min-w-0 select-text rounded-sm bg-transparent text-foreground outline-none ring-1 ring-inset ring-ring/50 focus:ring-ring",
          props.className,
        )}
        defaultValue={props.value}
        onFocus={(event) => {
          // Once: focus taken back keeps what was typed.
          if (selected.current) return;
          selected.current = true;
          event.currentTarget.select();
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (settled.current) return;
          if (appTakes()) {
            const input = event.currentTarget;
            // Taken by the app, or by leaving the window: the field stays, focused.
            setTimeout(() => {
              if (!settled.current && input.isConnected) input.focus();
            });
            return;
          }
          // Leaving for a button lets the button act, and keeps the old name.
          if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest("button")) {
            props.onCancel();
            return;
          }
          commit(event.currentTarget.value);
        }}
      />
      <Tooltip open={refused !== null}>
        <TooltipPopup anchor={field} side="bottom" id={noteId}>
          {refused}
        </TooltipPopup>
      </Tooltip>
    </>
  );
}
