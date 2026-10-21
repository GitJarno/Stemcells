import "../tokens/stemcells.css";
import "../tabs/workspace.css";

import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { PanelMaximizedContext, WorkbenchPanel } from "./chatPanel";
import { render } from "./testRender";

/** A tab's page: its workbench, inside the pages, which may be moving. */
function page(moving: boolean): { readonly workbench: HTMLElement } & Disposable {
  const pages = document.createElement("div");
  pages.setAttribute("data-stemcells-pages", "");
  pages.toggleAttribute("data-moving", moving);
  const workbench = document.createElement("div");
  pages.append(workbench);
  document.body.append(pages);
  return { workbench, [Symbol.dispose]: () => pages.remove() };
}

/** Upstream's panel, down to its frame and what it holds. */
function Frame(props: { children?: ReactNode }) {
  return <section data-panel-frame="">{props.children}</section>;
}

function Panel(props: {
  workbench: HTMLElement;
  shows: boolean;
  focused: boolean;
  maximized?: boolean;
}) {
  return (
    <WorkbenchPanel
      workbench={props.workbench}
      shows={props.shows}
      focused={props.focused}
      maximized={props.maximized ?? false}
      Frame={Frame}
      frameProps={{}}
    >
      <div data-live-surface="" />
    </WorkbenchPanel>
  );
}

// The arriving page used to slide in without its Surface: the Surface came
// at the turn, mid-slide, and the chat beside it jumped narrower.
describe("a page off stage keeps its Surface's frame", () => {
  it("holding nothing, inert, and the same frame holds the surfaces on stage", async () => {
    using stage = page(false);
    const { workbench } = stage;
    await using screen = await render(<Panel workbench={workbench} shows={false} focused />);
    const frame = workbench.querySelector("[data-panel-frame]");
    expect(frame).not.toBeNull();
    expect(frame?.closest("[inert]")).not.toBeNull();
    // No live browser off stage.
    expect(workbench.querySelector("[data-live-surface]")).toBeNull();

    await screen.rerender(<Panel workbench={workbench} shows focused />);
    expect(workbench.querySelector("[data-panel-frame]")).toBe(frame);
    expect(frame?.closest("[inert]")).toBeNull();
    expect(
      frame?.querySelector("[data-stemcells-surface-body] [data-live-surface]"),
    ).not.toBeNull();
  });

  it("only for its focused Cell", async () => {
    using stage = page(false);
    const { workbench } = stage;
    await using _screen = await render(
      <Panel workbench={workbench} shows={false} focused={false} />,
    );
    expect(workbench.childElementCount).toBe(0);
  });
});

describe("what a Surface shows, coming with the stage", () => {
  const fades = (workbench: HTMLElement) =>
    workbench
      .querySelector("[data-stemcells-surface-body]")
      ?.getAnimations()
      .some(
        (animation) =>
          animation instanceof CSSTransition && animation.transitionProperty === "opacity",
      ) ?? false;

  it("fades in while the pages move", async () => {
    using stage = page(true);
    const { workbench } = stage;
    await using screen = await render(<Panel workbench={workbench} shows={false} focused />);
    await screen.rerender(<Panel workbench={workbench} shows focused />);
    await vi.waitFor(() => expect(fades(workbench)).toBe(true));
  });

  it("is simply there at rest", async () => {
    using stage = page(false);
    const { workbench } = stage;
    await using screen = await render(<Panel workbench={workbench} shows={false} focused />);
    await screen.rerender(<Panel workbench={workbench} shows focused />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(fades(workbench)).toBe(false);
  });
});

// The page gives a maximized panel all its room. It used to find the panel
// with a `:has()` on the page, which restyled the whole page whenever
// anything in a chat changed: 15–20 ms a frame while a border was dragged.
describe("a maximized panel tells its page", () => {
  it("while it is drawn maximized, and no longer once it isn't or is gone", async () => {
    using stage = page(false);
    const { workbench } = stage;
    const tell = vi.fn();
    const Told = (props: { maximized: boolean; focused: boolean }) => (
      <PanelMaximizedContext value={tell}>
        <Panel workbench={workbench} shows focused={props.focused} maximized={props.maximized} />
      </PanelMaximizedContext>
    );
    await using screen = await render(<Told maximized={false} focused />);
    expect(tell).not.toHaveBeenCalled();
    await screen.rerender(<Told maximized focused />);
    expect(tell).toHaveBeenLastCalledWith(true);
    await screen.rerender(<Told maximized={false} focused />);
    expect(tell).toHaveBeenLastCalledWith(false);
    await screen.rerender(<Told maximized focused />);
    expect(tell).toHaveBeenLastCalledWith(true);
    await screen.unmount();
    expect(tell).toHaveBeenLastCalledWith(false);
    expect(tell.mock.calls.filter(([on]) => on).length).toBe(2);
    expect(tell.mock.calls.filter(([on]) => !on).length).toBe(2);
  });
});
