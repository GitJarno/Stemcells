import "../tokens/stemcells.css";
import "./workspace.css";

import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { PagerPage, TabPager } from "./TabPager";

const TABS = ["one", "two", "three", "four"];

function Pages(props: { activeId: string; onTurn: (tabId: string) => void }) {
  return (
    <div style={{ position: "relative", width: 400, height: 300 }}>
      <TabPager tabIds={TABS} activeId={props.activeId} onTurn={props.onTurn}>
        {TABS.map((tabId) => (
          <PagerPage key={tabId} tabId={tabId} onStage={tabId === props.activeId}>
            {tabId}
          </PagerPage>
        ))}
      </TabPager>
    </div>
  );
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

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

    pages.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, cancelable: true }));
    expect(pages.hasAttribute("data-moving")).toBe(true);
    for (let i = 0; i < 9; i++) {
      await nextFrame();
      pages.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, cancelable: true }));
      expect(pages.hasAttribute("data-moving")).toBe(true);
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
