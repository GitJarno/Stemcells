import "../../index.css";
import "../tokens/stemcells.css";
import "../pages/frame.css";
import "../tabs/workspace.css";

import type { CSSProperties } from "react";
import { describe, expect, it } from "vite-plus/test";

import { TabStrip } from "../tabs/TabStrip";
import { render } from "./testRender";

/**
 * The tab strip's row stands on the line the traffic lights and upstream's sidebar button
 * share, the middle of upstream's topbar (`--stemcells-controls-line`,
 * upstream/controlsLine.contract.test.ts), whatever the topbar measures.
 */
function Frame(props: { topbar?: string }) {
  const style = props.topbar
    ? ({ "--workspace-topbar-height": props.topbar } as CSSProperties)
    : undefined;
  return (
    <div data-slot="sidebar-wrapper" style={style}>
      <div data-stemcells-workspace="" className="flex flex-col">
        <TabStrip
          tabs={[]}
          activeTabId={null}
          aski={{ active: false, cell: null, chat: { status: "starting" } }}
          newCell={null}
          newTabRef={{ current: null }}
          windowTabs={0}
          onActivate={() => undefined}
          onClose={() => undefined}
          onMove={() => undefined}
          onNew={() => undefined}
          onRename={() => undefined}
        />
        <div data-stemcells-slate="" />
      </div>
    </div>
  );
}

/** How far down the window's top (the frame's) an element's middle is. */
const centre = (element: Element, frame: Element) => {
  const box = element.getBoundingClientRect();
  return (box.top + box.bottom) / 2 - frame.getBoundingClientRect().top;
};

describe("the tab strip on the controls' line", () => {
  it.each<[string, string | undefined, number]>([
    // A Mac's window and a browser: upstream's topbar, the lights on its middle.
    ["a Mac's topbar", undefined, 26],
    // Windows' caption buttons, in a strip of 40 px.
    ["Windows' caption strip", "40px", 20],
  ])("centres Aski's tab and + on the line, under %s", async (_, topbar, line) => {
    await using screen = await render(<Frame {...(topbar ? { topbar } : {})} />);
    const frame = screen.container.querySelector('[data-slot="sidebar-wrapper"]')!;
    const strip = frame.querySelector("[data-stemcells-tab-strip]")!;
    const aski = strip.querySelector('[data-stemcells-tab="aski"]')!;
    const plus = strip.querySelector('button[aria-label="New tab"]')!;
    expect(centre(aski, frame)).toBeCloseTo(line, 0);
    expect(centre(plus, frame)).toBeCloseTo(line, 0);
    // The slate starts at the foot of the strip's row, 36 px tall round the line.
    const slate = frame.querySelector("[data-stemcells-slate]")!;
    const top = frame.getBoundingClientRect().top;
    expect(strip.getBoundingClientRect().bottom - top).toBe(line + 18);
    expect(slate.getBoundingClientRect().top - top).toBe(line + 18);
  });
});
