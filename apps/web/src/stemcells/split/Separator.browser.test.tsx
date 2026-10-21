import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { growSides } from "./grow";
import { PASS_THROUGH_MS, Separator, type Sides } from "./Separator";
import { HOLD, NUDGE } from "./split";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Two Cells side by side, 400 px each, a border between them. */
function Row(props: {
  sides: Sides;
  width?: number;
  onPress?: () => void;
  onClick?: () => void;
  onRowClick?: () => void;
}) {
  return (
    <div
      data-testid="row"
      style={{ display: "flex", width: props.width ?? 800, height: 200 }}
      onClick={props.onRowClick}
    >
      <div data-testid="before" data-stemcells-share="" style={{ flex: "1 1 0%", minWidth: 0 }} />
      <Separator axis="x" label="Cell width" shares={[1, 1]} sides={props.sides} />
      <div data-testid="after" data-stemcells-share="" style={{ flex: "1 1 0%", minWidth: 0 }}>
        <button
          type="button"
          data-testid="in-cell"
          style={{ width: "100%", height: "100%" }}
          onPointerDown={props.onPress}
          onClick={props.onClick}
        />
      </div>
    </div>
  );
}

function setUp() {
  const keep = vi.fn();
  const even = vi.fn();
  const still = vi.fn();
  const sides: Sides = { ...growSides("x", [160, 160], keep, even), still };
  return { keep, even, still, sides };
}

/** The border and its Cells, as a test drives them. */
function partsOf(container: HTMLElement) {
  const separator = container.querySelector<HTMLElement>('[role="separator"]')!;
  const width = (id: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.getBoundingClientRect().width;
  const x = separator.getBoundingClientRect().left + separator.offsetWidth / 2;
  const pointer = (type: string, clientX: number) =>
    separator.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, button: 0, buttons: 1, clientX, bubbles: true }),
    );
  return { separator, width, x, pointer };
}

/**
 * A border gliding (a double-click evens the row) over a Cell's button, and
 * a press and release over the button as the page sends them: the press
 * lands on the border's reach, the page's click on the row both are in.
 */
async function passingThrough() {
  const onPress = vi.fn();
  const onClick = vi.fn();
  const onRowClick = vi.fn();
  const { sides } = setUp();
  // Narrow enough that the Cell is in the test page's view, where a press finds it.
  const screen = await render(
    <Row sides={sides} width={300} onPress={onPress} onClick={onClick} onRowClick={onRowClick} />,
  );
  onTestFinished(() => screen[Symbol.asyncDispose]());
  const { separator } = partsOf(screen.container);
  const row = screen.container.querySelector<HTMLElement>('[data-testid="row"]')!;
  const button = screen.container.querySelector<HTMLElement>('[data-testid="in-cell"]')!;
  const box = button.getBoundingClientRect();
  const at = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
  separator.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  const press = () =>
    separator.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        button: 0,
        buttons: 1,
        bubbles: true,
        ...at,
      }),
    );
  const release = () => {
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true, ...at }));
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...at }));
  };
  return { onPress, onClick, onRowClick, separator, button, press, release };
}

describe("a border between Cells", () => {
  it("moves 1:1 under the pointer while held, and the layout keeps where it was let go", async () => {
    const { keep, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { width, x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + 120);
    await nextFrame();
    expect(document.documentElement.getAttribute("data-stemcells-splitting")).toBe("x");
    expect(width("before")).toBeCloseTo(520, 0);
    expect(width("after")).toBeCloseTo(280, 0);
    pointer("pointerup", x + 120);
    expect(keep).toHaveBeenCalledWith({ before: 520, after: 280 });
    expect(document.documentElement.hasAttribute("data-stemcells-splitting")).toBe(false);
  });

  it("holds at even near it, and stops at a Cell's floor", async () => {
    const { keep, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { width, x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + HOLD);
    await nextFrame();
    expect(width("before")).toBeCloseTo(400, 0);
    pointer("pointermove", x + 1000);
    await nextFrame();
    expect(width("after")).toBeCloseTo(160, 0);
    pointer("pointerup", x + 1000);
    expect(keep).toHaveBeenLastCalledWith({ before: 640, after: 160 });
  });

  it("a press that never moves changes nothing", async () => {
    const { keep, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointerup", x);
    expect(keep).not.toHaveBeenCalled();
  });

  it("holds what the Cells show still while it moves, and lets go once it rests", async () => {
    const { still, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + 50);
    await nextFrame();
    expect(still).toHaveBeenLastCalledWith(expect.any(HTMLElement), true, "pair");
    await vi.waitFor(() =>
      expect(still).toHaveBeenLastCalledWith(expect.any(HTMLElement), false, "pair"),
    );
    pointer("pointermove", x + 80);
    await nextFrame();
    expect(still).toHaveBeenLastCalledWith(expect.any(HTMLElement), true, "pair");
    pointer("pointerup", x + 80);
    expect(still).toHaveBeenLastCalledWith(expect.any(HTMLElement), false, "pair");
  });

  it("a double-click evens the row out, gliding there with what it shows held still", async () => {
    const { even, still, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator } = partsOf(screen.container);
    separator.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(even).toHaveBeenCalledOnce();
    expect(separator.parentElement!.hasAttribute("data-stemcells-split-glide")).toBe(true);
    // Only what grows by a share glides: the rule names it, never `> *`.
    expect(getComputedStyle(separator.previousElementSibling!).transitionProperty).toBe(
      "flex-grow",
    );
    expect(still).toHaveBeenLastCalledWith(separator, true, "row");
    await vi.waitFor(() => expect(still).toHaveBeenLastCalledWith(separator, false, "row"));
  });

  // Gliding away from under a resting pointer, the border keeps it: left
  // behind in a Cell, it would restyle all of the Cell mid-glide.
  it("keeps the pointer it was double-clicked under while it glides, until the pointer moves", async () => {
    const { sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator, x, pointer } = partsOf(screen.container);
    separator.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(separator.hasAttribute("data-gliding")).toBe(true);
    const reach = getComputedStyle(separator, "::before");
    expect(reach.position).toBe("absolute");
    expect(Number.parseFloat(reach.width)).toBeGreaterThanOrEqual(2 * 800);
    pointer("pointermove", x + 1);
    expect(separator.hasAttribute("data-gliding")).toBe(false);

    // Typed, it never reaches: the pointer may be anywhere.
    separator.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(separator.hasAttribute("data-gliding")).toBe(false);

    separator.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await vi.waitFor(() => expect(separator.hasAttribute("data-gliding")).toBe(false));
  });

  // A press over a Cell while the border kept the pointer landed on the
  // border's reach, and the Cell never had it.
  it("passes a press over a Cell while it glides on to the Cell, its click with it", async () => {
    const { onPress, onClick, onRowClick, separator, button, press, release } =
      await passingThrough();
    press();
    expect(separator.hasAttribute("data-gliding")).toBe(false);
    expect(separator.hasAttribute("data-held")).toBe(false);
    expect(onPress).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
    release();
    expect(onClick).toHaveBeenCalledOnce();
    // The page clicked the row, which both the press and the release were
    // on; with the Cell's click bubbling up too, the row heard two.
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  // The release listener outlived a cancelled press, and the next release
  // over the same Cell clicked it.
  it.each([
    ["cancelled", () => window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }))],
    ["the window losing the focus", () => window.dispatchEvent(new Event("blur"))],
  ])("leaves no click behind for a press passed on and then %s", async (_, end) => {
    const { onClick, press, release } = await passingThrough();
    press();
    end();
    release();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("leaves no click behind for a press passed on and held past its time", async () => {
    const { onClick, press, release } = await passingThrough();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      press();
      vi.advanceTimersByTime(PASS_THROUGH_MS);
    } finally {
      vi.useRealTimers();
    }
    release();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Escape puts a held border back where the press found it", async () => {
    const { keep, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator, width, x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + 120);
    await nextFrame();
    expect(width("before")).toBeCloseTo(520, 0);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(width("before")).toBeCloseTo(400, 0);
    expect(separator.hasAttribute("data-held")).toBe(false);
    pointer("pointerup", x + 120);
    expect(keep).not.toHaveBeenCalled();
  });

  it("lets go when its button is found up, and when the window goes", async () => {
    const { keep, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator, x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + 40);
    await nextFrame();
    separator.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, buttons: 0, clientX: x + 80, bubbles: true }),
    );
    expect(separator.hasAttribute("data-held")).toBe(false);
    expect(keep).toHaveBeenCalledOnce();

    pointer("pointerdown", x);
    expect(separator.hasAttribute("data-held")).toBe(true);
    window.dispatchEvent(new FocusEvent("blur"));
    expect(separator.hasAttribute("data-held")).toBe(false);
  });

  it("a double-click whose press dragged the border isn't one", async () => {
    const { even, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator, x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + 60);
    await nextFrame();
    pointer("pointerup", x + 60);
    separator.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(even).not.toHaveBeenCalled();
  });

  // Gone mid-drag or mid-glide, the border left its Cells' transcripts held
  // at their old width.
  it("lets go of what it held still when it goes mid-drag or mid-glide", async () => {
    const { still, sides } = setUp();
    const screen = await render(<Row sides={sides} />);
    const { separator, x, pointer } = partsOf(screen.container);
    pointer("pointerdown", x);
    pointer("pointermove", x + 50);
    await nextFrame();
    expect(still).toHaveBeenLastCalledWith(separator, true, "pair");
    await screen.unmount();
    expect(still).toHaveBeenLastCalledWith(separator, false, "pair");
    expect(document.documentElement.hasAttribute("data-stemcells-splitting")).toBe(false);
    await screen[Symbol.asyncDispose]();

    const again = setUp();
    const gliding = await render(<Row sides={again.sides} />);
    const border = partsOf(gliding.container).separator;
    border.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(again.still).toHaveBeenLastCalledWith(border, true, "row");
    await gliding.unmount();
    expect(again.still).toHaveBeenLastCalledWith(border, false, "row");
    await gliding[Symbol.asyncDispose]();
  });

  it("arrow keys nudge it and Enter evens the row out", async () => {
    const { keep, even, sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator } = partsOf(screen.container);
    separator.focus();
    separator.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(keep).toHaveBeenLastCalledWith({ before: 400 - NUDGE, after: 400 + NUDGE });
    separator.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(even).toHaveBeenCalledOnce();
  });

  it("reads to a screen reader as a focusable separator with its value", async () => {
    const { sides } = setUp();
    await using screen = await render(<Row sides={sides} />);
    const { separator } = partsOf(screen.container);
    expect(separator.tabIndex).toBe(0);
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
  });
});
