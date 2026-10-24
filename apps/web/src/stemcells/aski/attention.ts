// What holds Aski's eyes. While Aski's field has the keyboard, the eyes
// follow its caret; while Aski answers, it thinks, its eyes up and a little
// to the left, still. A mood types a character into them in place of the
// blocks, and holds them so while its cause holds: first `- -` while nobody is at this Mac, `x x`
// while its server doesn't answer, nothing while words are typed or a chat
// waits on the person, `? ?` while Aski's newest turn failed and nothing
// was typed since, `^ ^` once Cells have landed and none works or needs
// the person.

import type { Standing } from "../rail/projects.ts";
import type { Mood } from "./mood.ts";
import type { Point } from "./eyes.ts";

/** What the server says of this Mac and its chats: whether anyone is at it, whether it answers, and how the chats stand. */
export interface Home {
  /** Somebody is at the Mac; false while nobody is, and while the last word before it stopped answering said so. */
  readonly present: boolean;
  readonly answers: boolean;
  /** Every open chat but Aski's own. */
  readonly chats: ReadonlyArray<Standing>;
}

/**
 * The mood this Mac's word puts in Aski's eyes: `- -` while nobody is at
 * it, `x x` while it doesn't answer otherwise, `^ ^` once a chat has landed
 * and none works or needs the person.
 */
export function homeMood(home: Home): Mood | undefined {
  if (!home.present) return "asleep";
  if (!home.answers) return "crashed";
  const count = (standing: Standing) => home.chats.filter((chat) => chat === standing).length;
  return count("done") > 0 && count("working") === 0 && count("needsYou") === 0
    ? "pleased"
    : undefined;
}

/** What the page itself knows of Aski's field and its chat. */
export interface Attention {
  /** Words stand in Aski's field while it has the keyboard. */
  readonly listening: boolean;
  /** A chat, Aski's own or a Cell's, waits on the person. */
  readonly waits: boolean;
  /** Aski's newest turn failed, and nothing was typed in its field since. */
  readonly puzzled: boolean;
}

/**
 * The mood in Aski's eyes: nobody home or no answer holds them; else words
 * being typed and a chat waiting keep the cursor, and a failed turn, then
 * every Cell's work done, types theirs.
 */
export function eyesMood(home: Mood | undefined, attention: Attention): Mood | undefined {
  if (home === "asleep" || home === "crashed") return home;
  if (attention.listening || attention.waits) return undefined;
  return attention.puzzled ? "puzzled" : home;
}

/** Aski's field as the eyes read it: where its caret stands while it has the keyboard, and whether words stand in it. */
export interface Field {
  readonly caret: Point | undefined;
  readonly words: boolean;
}

/** Where the selection's caret stands on the page while it is inside `editor`; undefined otherwise. */
function caretIn(editor: HTMLElement): Point | undefined {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0 || !editor.contains(selection.focusNode))
    return undefined;
  const range = document.createRange();
  range.setStart(selection.focusNode!, selection.focusOffset);
  range.collapse(true);
  const at = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (at.height > 0) return { x: at.left, y: at.top + at.height / 2 };
  // An empty line has no rect of its own: the line it stands on does.
  const node = selection.focusNode;
  const line = node instanceof HTMLElement ? node : node?.parentElement;
  const box = (line ?? editor).getBoundingClientRect();
  return { x: box.left, y: box.top + box.height / 2 };
}

/**
 * Watches Aski's field, the editor `find` returns inside `place`: tells
 * `changed` where its caret stands while it has the keyboard and whether
 * words stand in it, each time either changes. Returns the function that
 * stops watching.
 */
export function watchField(
  place: HTMLElement,
  find: (place: HTMLElement) => HTMLElement | null,
  changed: (field: Field) => void,
): () => void {
  let last: Field = { caret: undefined, words: false };
  const read = (): void => {
    const editor = find(place);
    const focused = editor !== null && editor.contains(document.activeElement);
    const caret = focused ? caretIn(editor) : undefined;
    const words = focused && (editor.textContent ?? "").trim() !== "";
    if (last.caret?.x === caret?.x && last.caret?.y === caret?.y && last.words === words) return;
    last = { caret, words };
    changed(last);
  };
  document.addEventListener("selectionchange", read);
  place.addEventListener("input", read);
  place.addEventListener("focusin", read);
  place.addEventListener("focusout", read);
  return () => {
    document.removeEventListener("selectionchange", read);
    place.removeEventListener("input", read);
    place.removeEventListener("focusin", read);
    place.removeEventListener("focusout", read);
  };
}
