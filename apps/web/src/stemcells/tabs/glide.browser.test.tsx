import "../tokens/stemcells.css";

import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { glidePanes } from "./glide";
import { readWorkspace, updateWorkspace } from "./store";

function Panes() {
  return (
    <div data-stemcells-slate="" style={{ display: "flex", width: 400, height: 200 }}>
      <div data-stemcells-pane="a" style={{ flex: 1 }} />
      <div data-stemcells-pane="b" style={{ flex: 1 }} />
      <div data-stemcells-drop-wash="" data-lit="false" />
    </div>
  );
}

/** A move as the carry makes one: the tabs change. */
const move = async () => {
  updateWorkspace((workspace) => ({ ...workspace }));
  return true;
};

const glideLeft = (screen: { container: HTMLElement }) => ({
  marked: document.documentElement.dataset.stemcellsGlide !== undefined,
  named: [...screen.container.querySelectorAll<HTMLElement>("[data-stemcells-pane]")].some(
    (pane) => pane.style.viewTransitionName !== "",
  ),
});

// Left on the page, the glide's mark keeps every drop wash hidden from then
// on (`glide.css`), and its names put the panes in every later transition.
describe("a glide", () => {
  it("leaves nothing of itself on the page once it has played", async () => {
    await using screen = await render(<Panes />);
    expect(await glidePanes(move)).toBe(true);
    await vi.waitFor(() => expect(glideLeft(screen)).toEqual({ marked: false, named: false }));
  });

  it("leaves nothing either when a second starts before the first has played", async () => {
    await using screen = await render(<Panes />);
    const before = readWorkspace();
    await Promise.all([glidePanes(move), glidePanes(move)]);
    expect(readWorkspace()).not.toBe(before);
    await vi.waitFor(() => expect(glideLeft(screen)).toEqual({ marked: false, named: false }));
  });
});
