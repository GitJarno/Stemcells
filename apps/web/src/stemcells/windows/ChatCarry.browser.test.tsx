import "../upstream/appStyles";
import "../tokens/stemcells.css";

import { describe, expect, it } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { carrying } from "./carrying";
import { ChatCarry, startChatCarry } from "./ChatCarry";

const cell = { environmentId: "env", threadId: "t1", draftId: null };

/** A slate holding one pane, whose Cell is the handle a chat is carried by, unless it's gone. */
function Slate(props: { cellGone?: boolean }) {
  return (
    <div style={{ position: "relative", width: 600, height: 400 }}>
      <ChatCarry onOpenTab={() => undefined} />
      <div data-stemcells-pane="p1" style={{ width: 300, height: 400 }}>
        {props.cellGone ? null : (
          <button type="button" onPointerDown={(event) => startChatCarry(event, cell)}>
            Cell
          </button>
        )}
      </div>
    </div>
  );
}

function pointer(element: Element, type: string, x: number, y: number, at?: number) {
  const event = new PointerEvent(type, {
    bubbles: true,
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
  // The hand's speed is read from the events' times.
  if (at !== undefined) Object.defineProperty(event, "timeStamp", { value: at });
  element.dispatchEvent(event);
}

const card = () => document.querySelector("[data-stemcells-chat-card]");

/** Picks the chat up by its Cell: the card is in the hand. */
function lift(container: HTMLElement): HTMLElement {
  const handle = container.querySelector("button")!;
  const box = handle.getBoundingClientRect();
  pointer(handle, "pointerdown", box.left + 4, box.top + 4);
  pointer(handle, "pointermove", box.left + 40, box.top + 40);
  return handle;
}

describe("a chat carried by its Cell", () => {
  it.each([
    ["the pointer is cancelled", (handle: Element) => pointer(handle, "pointercancel", 0, 0)],
    ["the pointer is lost", (handle: Element) => pointer(handle, "lostpointercapture", 0, 0)],
    ["the window loses focus", () => void window.dispatchEvent(new FocusEvent("blur"))],
  ] as const)("goes back when %s, and holds the keys off till then", async (_how, lose) => {
    await using screen = await render(<Slate />);
    const handle = lift(screen.container);
    await expect.poll(card).not.toBeNull();
    expect(carrying()).toBe(true);

    lose(handle);
    await expect.poll(card, { timeout: 3000 }).toBeNull();
    expect(carrying()).toBe(false);
    expect(handle.dataset.carrying).toBeUndefined();
  });

  // Left in the hand, the carry would hold every tab's chip and the keys
  // that wait on one (Gather, Undo Move) off for the rest of the session.
  it("thrown, leaves the hand empty", async () => {
    await using screen = await render(<Slate />);
    const handle = screen.container.querySelector("button")!;
    const box = handle.getBoundingClientRect();
    // The hand's own clock: only the gaps between its events count.
    const t = 1000;
    pointer(handle, "pointerdown", box.left + 4, box.top + 4, t);
    pointer(handle, "pointermove", box.left + 40, box.top + 40, t + 10);
    await expect.poll(card).not.toBeNull();
    pointer(handle, "pointermove", box.left + 240, box.top + 40, t + 30);
    pointer(handle, "pointerup", box.left + 240, box.top + 40, t + 40);

    await expect.poll(card).toBeNull();
    expect(carrying()).toBe(false);
  });

  it("goes back when its Cell goes mid-carry, and the document hears the pointer lost", async () => {
    await using screen = await render(<Slate />);
    lift(screen.container);
    await expect.poll(card).not.toBeNull();

    await screen.rerender(<Slate cellGone />);
    document.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    await expect.poll(card, { timeout: 3000 }).toBeNull();
    expect(carrying()).toBe(false);
  });
});
