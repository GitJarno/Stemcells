import "../tokens/stemcells.css";
import "./workspace.css";

import { describe, expect, it, vi } from "vite-plus/test";

import { fakeTimers, render } from "../upstream/testRender";
import { PagerPage, TabPager } from "./TabPager";

const TABS = ["one", "two", "three", "four"];

function Pages(props: { activeId: string; onTurn: (tabId: string) => void }) {
  return (
    <div style={{ position: "relative", width: 400, height: 300 }}>
      <TabPager tabIds={TABS} activeId={props.activeId} onTurn={props.onTurn}>
        {TABS.map((tabId) => (
          <PagerPage key={tabId} tabId={tabId} onStage={tabId === props.activeId}>
            {tabId}
            {/* A border between two Cells, as the grid draws it (`split/Separator.tsx`). */}
            <div data-stemcells-split="x" data-testid={`border-${tabId}`} />
          </PagerPage>
        ))}
      </TabPager>
    </div>
  );
}

// A native view over a page can't move with it, so it steps aside while
// `data-moving` is on. Dropped early, the view sits half over the next page.
describe("TabPager data-moving", () => {
  it("stays on through a far turn's slide until its stand-in has gone back", async () => {
    await using screen = await render(<Pages activeId="one" onTurn={() => undefined} />);
    const pages = screen.container.querySelector<HTMLElement>("[data-stemcells-pages]")!;
    const first = screen.container.querySelector<HTMLElement>('[data-stemcells-page="one"]')!;
    expect(pages.hasAttribute("data-moving")).toBe(false);

    await screen.rerender(<Pages activeId="four" onTurn={() => undefined} />);
    expect(pages.hasAttribute("data-moving")).toBe(true);
    // The page left stands in beside the one arriving.
    expect(first.style.transform).toMatch(/^translate3d\(200%,/);

    await vi.waitFor(() => expect(pages.hasAttribute("data-moving")).toBe(false), {
      timeout: 3000,
    });
    expect(first.style.transform).toMatch(/^translate3d\(0%,/);
  });

  it("is on from the swipe's first move until the strip rests on the page it turned to", async () => {
    const onTurn = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} />);
    const pages = screen.container.querySelector<HTMLElement>("[data-stemcells-pages]")!;
    const strip = screen.container.querySelector<HTMLElement>("[data-stemcells-strip]")!;

    // A trackpad sends a wheel event a frame: each one comes once the strip has drawn the last.
    for (let i = 0; i < 10; i++) {
      const drawn = strip.style.transform;
      pages.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, cancelable: true }));
      expect(pages.hasAttribute("data-moving")).toBe(true);
      await vi.waitFor(() => expect(strip.style.transform).not.toBe(drawn), { interval: 1 });
    }

    await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith("two"), { timeout: 3000 });
    await screen.rerender(<Pages activeId="two" onTurn={onTurn} />);
    expect(pages.hasAttribute("data-moving")).toBe(true);
    await vi.waitFor(() => expect(pages.hasAttribute("data-moving")).toBe(false), {
      timeout: 3000,
    });
    expect(onTurn).toHaveBeenCalledTimes(1);
  });
});

/** Where the strip shows, in pages. */
const shown = (strip: HTMLElement) =>
  -new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41 / strip.clientWidth;

/** The strip's slide, held still `ms` into it. */
function holdSlide(strip: HTMLElement, ms: number): void {
  const [slide] = strip.getAnimations();
  slide!.pause();
  slide!.currentTime = ms;
}

// A slide taken over by a newer turn (a second click before the first has
// landed) carries on with the speed it has, as every spring here does
// (tokens/spring.ts). Set off from rest instead, the strip stops dead.
describe("TabPager turning again mid-slide", () => {
  it("carries on from where the strip is, at the speed it has", async () => {
    await using screen = await render(<Pages activeId="one" onTurn={() => undefined} />);
    const strip = screen.container.querySelector<HTMLElement>("[data-stemcells-strip]")!;
    await screen.rerender(<Pages activeId="two" onTurn={() => undefined} />);
    holdSlide(strip, 150);
    const at = shown(strip);
    expect(at).toBeGreaterThan(0.5);

    await screen.rerender(<Pages activeId="three" onTurn={() => undefined} />);
    // Under way from the frame it took over in: it doesn't stand still
    // while the turn renders, waiting for a frame to set off.
    expect(strip.getAnimations()[0]!.pending).toBe(false);
    holdSlide(strip, 0);
    expect(shown(strip)).toBeCloseTo(at, 2);
    // One frame on: from rest it would have gone 0.025 of a page.
    holdSlide(strip, 16);
    expect(shown(strip) - at).toBeGreaterThan(0.05);
  });
});

describe("TabPager and the borders between Cells", () => {
  it("never starts a swipe from a border", async () => {
    const onTurn = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} />);
    const pages = screen.container.querySelector<HTMLElement>("[data-stemcells-pages]")!;
    const border = screen.container.querySelector<HTMLElement>('[data-testid="border-one"]')!;
    const page = screen.container.querySelector<HTMLElement>('[data-stemcells-page="one"]')!;
    const at = page.getBoundingClientRect().left;
    // The pager's frames and timers, run by hand: a swipe it never started leaves nothing to run.
    using _timers = fakeTimers();
    for (let i = 0; i < 10; i++) {
      border.dispatchEvent(
        new WheelEvent("wheel", { deltaX: 30, cancelable: true, bubbles: true }),
      );
      vi.advanceTimersToNextFrame();
    }
    expect(page.getBoundingClientRect().left).toBe(at);
    await vi.advanceTimersByTimeAsync(600);
    expect(onTurn).not.toHaveBeenCalled();
    expect(pages.hasAttribute("data-moving")).toBe(false);
  });
});
