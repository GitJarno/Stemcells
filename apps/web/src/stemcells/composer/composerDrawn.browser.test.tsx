import { describe, expect, it, vi } from "vite-plus/test";

import { PaneComposerContext } from "../tabs/paneCell";
import { render } from "../upstream/testRender";
import { CellComposerLine } from "./CellComposerLine";

// The pane hid its Cell's pill as soon as it had a chat to show, so a chat
// shown without a composer (still loading) named its Cell nowhere. The line
// over a composer tells the pane when one is drawn.
describe("the line over a composer", () => {
  it("tells its pane a composer is drawn while it is", async () => {
    const tell = vi.fn();
    const screen = await render(
      <PaneComposerContext value={tell}>
        <CellComposerLine />
      </PaneComposerContext>,
    );
    expect(tell).toHaveBeenLastCalledWith(true);
    await screen.unmount();
    expect(tell).toHaveBeenLastCalledWith(false);
    await screen[Symbol.asyncDispose]();
  });
});
