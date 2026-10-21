import "../tokens/stemcells.css";

import { describe, expect, it } from "vite-plus/test";

import { readWorkspace } from "../tabs/store";
import { render } from "../upstream/testRender";
import { CellThrows, throwFromCarry, useCellAway } from "./CellThrow";

const THREAD = "thrown-chat";
const cell = { environmentId: "env", threadId: THREAD, draftId: null };

/** The composer's text: its editor (ProseMirror) marks every Esc handled, on itself. */
function blanketEsc(element: HTMLDivElement | null) {
  element?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") event.preventDefault();
  });
}

/**
 * A window's content with the Cell's place on its line, a field, the
 * composer's text, and a popover kept mounted (closed unless `popover`).
 */
function Window(props: { readonly throws?: boolean; readonly popover?: boolean }) {
  const away = useCellAway(THREAD);
  return (
    <div>
      <div
        data-stemcells-slate=""
        style={{ position: "fixed", left: 0, top: 0, width: 800, height: 500 }}
      >
        <span
          data-stemcells-cell-box={THREAD}
          style={{ position: "absolute", left: 40, top: 440, width: 26, height: 28 }}
        />
        <input data-testid="field" />
        <div
          ref={blanketEsc}
          className="ProseMirror"
          contentEditable
          suppressContentEditableWarning
          data-testid="composer"
        />
        {/* As Base UI keeps a popover's popup: always a dialog, open or not. */}
        <div
          role="dialog"
          data-slot="popover-popup"
          {...(props.popover ? { "data-open": "" } : { "data-closed": "", hidden: true })}
        />
      </div>
      <output data-testid="away">{away ? "away" : "home"}</output>
      {props.throws === false ? null : <CellThrows />}
    </div>
  );
}

/** Thrown up and right from the middle of the window, hard. */
function toss() {
  throwFromCarry({
    cell,
    centre: { x: 300, y: 300 },
    velocity: { x: 500, y: -900 },
    grip: { x: 0, y: 0 },
    at: performance.now(),
    tabId: readWorkspace().activeTabId,
  });
}

/**
 * Find in the chat, as upstream closes it on Esc (`useChatShortcuts`): on
 * the window, after everything else, unless the Esc was marked handled.
 */
function openFind() {
  const find = { open: true };
  const dismiss = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !find.open || event.defaultPrevented) return;
    event.preventDefault();
    find.open = false;
  };
  window.addEventListener("keydown", dismiss);
  return Object.assign(find, { [Symbol.dispose]: () => removeEventListener("keydown", dismiss) });
}

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const next = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => next(left - 1));
    next(n);
  });

const escape = (target: EventTarget) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );

const thrownBox = () => document.querySelector<HTMLElement>("[data-stemcells-thrown]");
const awayIn = (screen: { container: HTMLElement }) =>
  screen.container.querySelector("[data-testid='away']")?.textContent;
/** Still in the air: not sent home. */
const stillFlying = () => thrownBox() !== null && thrownBox()!.getAnimations().length === 0;

describe("a thrown Cell and Esc", () => {
  // The popover on the Cell's own line is always on the page, a closed
  // dialog: counting it as open, Esc never sent a Cell home.
  it("one Esc sends a Cell in the air home, past a closed popover kept on the page", async () => {
    await using screen = await render(<Window />);
    toss();
    await frames(3);
    expect(thrownBox()).not.toBeNull();
    expect(awayIn(screen)).toBe("away");
    escape(document.body);
    await expect.poll(() => awayIn(screen)).toBe("home");
    expect(thrownBox()).toBeNull();
  });

  it("is still the Cell's with the composer's text focused, whose editor marks every Esc handled", async () => {
    await using screen = await render(<Window />);
    toss();
    await frames(3);
    const composer = screen.container.querySelector<HTMLElement>("[data-testid='composer']")!;
    composer.focus();
    escape(composer);
    await expect.poll(() => awayIn(screen)).toBe("home");
  });

  // Esc was taken for the whole flight, in the capture phase: a field, a
  // menu or the palette never got it while a Cell flew.
  it("leaves Esc to a field with focus, and to a layer that is open", async () => {
    await using screen = await render(<Window />);
    toss();
    await frames(3);
    const field = screen.container.querySelector<HTMLInputElement>("[data-testid='field']")!;
    field.focus();
    escape(field);
    await frames(2);
    expect(stillFlying()).toBe(true);
    field.blur();
    await screen.rerender(<Window popover />);
    escape(document.body);
    await frames(2);
    expect(stillFlying()).toBe(true);
    expect(awayIn(screen)).toBe("away");
  });

  // Find open: Esc closed find and sent the Cell home too.
  it("does one thing per Esc with find open: find closes, or with the composer focused the Cell goes home", async () => {
    await using screen = await render(<Window />);
    toss();
    await frames(3);
    using find = openFind();
    escape(document.body);
    await frames(2);
    expect(find.open).toBe(false);
    expect(stillFlying()).toBe(true);
    // In the composer, upstream's find leaves an Esc the editor marked: the Cell has it.
    find.open = true;
    const composer = screen.container.querySelector<HTMLElement>("[data-testid='composer']")!;
    composer.focus();
    escape(composer);
    await expect.poll(() => awayIn(screen)).toBe("home");
    expect(find.open).toBe(true);
  });
});

describe("a thrown Cell whose page goes", () => {
  // Leaving the chat's page mid-flight kept its launch: coming back
  // started a stale flight, and its place stood empty meanwhile.
  it("is home at once: its place shows it and nothing of it is left", async () => {
    await using screen = await render(<Window />);
    toss();
    await frames(3);
    expect(awayIn(screen)).toBe("away");
    await screen.rerender(<Window throws={false} />);
    await expect.poll(() => awayIn(screen)).toBe("home");
    await screen.rerender(<Window />);
    await frames(2);
    expect(thrownBox()).toBeNull();
  });
});
