import "../tokens/stemcells.css";
import "./workspace.css";

import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { REST_SLOT } from "./proxy";
import { PagerPage, TabPager } from "./TabPager";

const TABS = ["one", "two", "three", "four"];
const WIDTH = 400;

function Pages(props: {
  activeId: string;
  onTurn: (tabId: string) => void;
  onAim?: (tabId: string) => void;
}) {
  return (
    <div style={{ position: "relative", width: WIDTH, height: 300 }}>
      <TabPager
        tabIds={TABS}
        activeId={props.activeId}
        onTurn={props.onTurn}
        {...(props.onAim ? { onAim: props.onAim } : {})}
      >
        {TABS.map((tabId) => (
          <PagerPage key={tabId} tabId={tabId} onStage={tabId === props.activeId}>
            {tabId}
          </PagerPage>
        ))}
      </TabPager>
    </div>
  );
}

const proxyOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-stemcells-pages]")!;

/** Where the pages show, in pages: the strip's own place and what its hold adds, as laid out. */
function shown(container: HTMLElement): number {
  const first = container.querySelector<HTMLElement>('[data-stemcells-page="one"]')!;
  const proxy = proxyOf(container);
  return (proxy.getBoundingClientRect().left - first.getBoundingClientRect().left) / WIDTH;
}

/** The fingers scroll the proxy to `slot`: a wheel event says it is them, then the scroll. */
function swipeTo(proxy: HTMLElement, slot: number): void {
  proxy.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, bubbles: true }));
  proxy.scrollTo({ left: slot * WIDTH, behavior: "instant" });
}

/**
 * Fingers down on the proxy, holding it between slots: no snap takes it to one and it doesn't
 * come to rest, so nobody hears its `scrollend`, until they lift.
 */
function fingersDown(proxy: HTMLElement): Disposable {
  const unheard = (event: Event) => event.stopImmediatePropagation();
  proxy.style.scrollSnapType = "none";
  window.addEventListener("scrollend", unheard, { capture: true });
  return {
    [Symbol.dispose]: () => {
      window.removeEventListener("scrollend", unheard, { capture: true });
      proxy.style.scrollSnapType = "";
    },
  };
}

describe("TabPager's swipe", () => {
  it("follows the proxy between slots, a page either way and no further, and gives at an end", async () => {
    await using screen = await render(<Pages activeId="two" onTurn={() => undefined} />);
    const proxy = proxyOf(screen.container);
    expect(proxy.scrollLeft).toBeCloseTo(REST_SLOT * WIDTH, 0);
    using _fingers = fingersDown(proxy);
    swipeTo(proxy, REST_SLOT + 0.3);
    await vi.waitFor(() => expect(shown(screen.container)).toBeCloseTo(1.3, 2));
    swipeTo(proxy, REST_SLOT + 1.7);
    await vi.waitFor(() => expect(shown(screen.container)).toBeCloseTo(2, 2));
    swipeTo(proxy, REST_SLOT - 0.5);
    await vi.waitFor(() => expect(shown(screen.container)).toBeCloseTo(0.5, 2));
  });

  it("gives a quarter of the move past the first page", async () => {
    await using screen = await render(<Pages activeId="one" onTurn={() => undefined} />);
    const proxy = proxyOf(screen.container);
    using _fingers = fingersDown(proxy);
    swipeTo(proxy, REST_SLOT - 0.4);
    await vi.waitFor(() => expect(shown(screen.container)).toBeCloseTo(-0.1, 2));
  });

  it("turns one page when the proxy lands a slot on, and puts the proxy back at rest", async () => {
    const onTurn = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} />);
    const proxy = proxyOf(screen.container);
    swipeTo(proxy, REST_SLOT + 1);
    await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith("two"), { timeout: 3000 });
    await screen.rerender(<Pages activeId="two" onTurn={onTurn} />);
    await vi.waitFor(() => expect(proxy.hasAttribute("data-moving")).toBe(false), {
      timeout: 3000,
    });
    expect(shown(screen.container)).toBeCloseTo(1, 3);
    expect(proxy.scrollLeft).toBeCloseTo(REST_SLOT * WIDTH, 0);
    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it("says which page it is headed for before it turns there, so its tab can light", async () => {
    const onTurn = vi.fn();
    const onAim = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} onAim={onAim} />);
    swipeTo(proxyOf(screen.container), REST_SLOT + 1);
    await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith("two"), { timeout: 3000 });
    expect(onAim).toHaveBeenCalledWith("two");
    expect(onAim.mock.invocationCallOrder[0]).toBeLessThan(onTurn.mock.invocationCallOrder[0]!);
  });

  it("comes to rest a pixel short of its slot without a slide for the pixel", async () => {
    // A slide nobody sees still runs its whole spring, and the tab turns only once it ends.
    const onTurn = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} />);
    const proxy = proxyOf(screen.container);
    const strip = screen.container.querySelector<HTMLElement>("[data-stemcells-strip]")!;
    // No snap: the proxy rests where it is put.
    proxy.style.scrollSnapType = "none";
    swipeTo(proxy, REST_SLOT + 1 - 1 / WIDTH);
    await vi.waitFor(() => expect(proxy.scrollLeft).toBeCloseTo(REST_SLOT * WIDTH, 0));
    expect(strip.getAnimations()).toHaveLength(0);
    expect(shown(screen.container)).toBeCloseTo(1, 3);
    await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith("two"));
  });

  it("turns one page however far one touch carries the proxy", async () => {
    // The skip: a hard swipe, or a coast taken for a second swipe, went a page too far.
    const onTurn = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} />);
    const proxy = proxyOf(screen.container);
    swipeTo(proxy, REST_SLOT + 2);
    await vi.waitFor(() => expect(onTurn).toHaveBeenCalled(), { timeout: 3000 });
    expect(onTurn).toHaveBeenCalledWith("two");
    await screen.rerender(<Pages activeId="two" onTurn={onTurn} />);
    await vi.waitFor(() => expect(proxy.scrollLeft).toBeCloseTo(REST_SLOT * WIDTH, 0), {
      timeout: 3000,
    });
    expect(shown(screen.container)).toBeCloseTo(1, 3);
    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it("undoes a scroll of the proxy the fingers didn't make", async () => {
    // A field focused on a page still arriving scrolls what it can to show itself.
    const onTurn = vi.fn();
    const onAim = vi.fn();
    await using screen = await render(<Pages activeId="one" onTurn={onTurn} onAim={onAim} />);
    const proxy = proxyOf(screen.container);
    // The browser's word on where that scroll will snap can come before the scroll is undone.
    const next = proxy.querySelector(`[data-stemcells-proxy-slot="${REST_SLOT + 1}"]`);
    proxy.dispatchEvent(Object.assign(new Event("scrollsnapchanging"), { snapTargetInline: next }));
    expect(onAim).not.toHaveBeenCalledWith("two");
    proxy.scrollTo({ left: (REST_SLOT + 1) * WIDTH, behavior: "instant" });
    await vi.waitFor(() => expect(proxy.scrollLeft).toBeCloseTo(REST_SLOT * WIDTH, 0));
    expect(shown(screen.container)).toBeCloseTo(0, 3);
    expect(onTurn).not.toHaveBeenCalled();
  });

  it("starts no swipe while a border between Cells is held", async () => {
    await using screen = await render(<Pages activeId="one" onTurn={() => undefined} />);
    const proxy = proxyOf(screen.container);
    expect(getComputedStyle(proxy).overflowX).toBe("scroll");
    document.documentElement.setAttribute("data-stemcells-splitting", "x");
    using _held = {
      [Symbol.dispose]: () => document.documentElement.removeAttribute("data-stemcells-splitting"),
    };
    expect(getComputedStyle(proxy).overflowX).toBe("hidden");
  });
});

// Under a rounded clip the compositor asks the page what each scroll starts on, and a swipe
// begun on a busy page waits for the answer (tasks/swipe-under-load.md).
describe("the slate round the pager", () => {
  it("clips square, its round corners painted over it", async () => {
    await using screen = await render(
      <div data-stemcells-workspace="">
        <div data-stemcells-slate="" style={{ width: WIDTH, height: 300 }} />
      </div>,
    );
    const slate = screen.container.querySelector<HTMLElement>("[data-stemcells-slate]")!;
    expect(getComputedStyle(slate).overflow).toBe("clip");
    expect(getComputedStyle(slate).borderRadius).toBe("0px");
    expect(getComputedStyle(slate, "::before").borderRadius).not.toBe("0px");
  });
});

// A native view over a page can't move with it, so it steps aside while
// `data-moving` is on. Dropped early, the view sits half over the next page.
describe("TabPager data-moving", () => {
  it("stays on through a far turn's slide until its stand-in has gone back", async () => {
    await using screen = await render(<Pages activeId="one" onTurn={() => undefined} />);
    const pages = proxyOf(screen.container);
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

  it("is on from the swipe's first move until the proxy rests", async () => {
    await using screen = await render(<Pages activeId="one" onTurn={() => undefined} />);
    const pages = proxyOf(screen.container);
    {
      using _fingers = fingersDown(pages);
      swipeTo(pages, REST_SLOT + 0.2);
      await vi.waitFor(() => expect(pages.hasAttribute("data-moving")).toBe(true));
    }
    swipeTo(pages, REST_SLOT);
    await vi.waitFor(() => expect(pages.hasAttribute("data-moving")).toBe(false), {
      timeout: 3000,
    });
  });
});

/** Where the strip itself shows, in pages. */
const stripAt = (strip: HTMLElement) =>
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
    const at = stripAt(strip);
    expect(at).toBeGreaterThan(0.5);

    await screen.rerender(<Pages activeId="three" onTurn={() => undefined} />);
    // Under way from the frame it took over in: it doesn't stand still
    // while the turn renders, waiting for a frame to set off.
    expect(strip.getAnimations()[0]!.pending).toBe(false);
    holdSlide(strip, 0);
    expect(stripAt(strip)).toBeCloseTo(at, 2);
    // One frame on: from rest it would have gone 0.025 of a page.
    holdSlide(strip, 16);
    expect(stripAt(strip) - at).toBeGreaterThan(0.05);
  });
});
