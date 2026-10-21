import "../tokens/stemcells.css";
import "./drop.css";

import { describe, expect, it } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { DropWash } from "./DropWash";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** A slate of two panes; upstream's overlay shows in the one named by `over`. */
function Slate(props: { over: "a" | "b" | null }) {
  return (
    <div data-testid="slate" style={{ position: "relative", display: "flex", width: 600 }}>
      {(["a", "b"] as const).map((id) => (
        <div key={id} data-stemcells-pane={id} style={{ flex: 1, height: 200 }}>
          {props.over === id ? <div data-chat-workspace-drop-overlay="true" /> : null}
          {/* Without its glide, so the test reads where the composer stands. */}
          <div
            data-chat-composer-stack="true"
            data-testid={`stack-${id}`}
            style={{ transition: "none" }}
          />
        </div>
      ))}
      <DropWash />
    </div>
  );
}

// The composer a carried file would land in rises toward the hand. The pane
// is marked from the wash, which already knows it: a `:has()` on the pane
// looking for upstream's overlay restyled the pane on any change in its chat.
describe("the pane a carried file would land in", () => {
  it("is marked while the file is over its chat, and only then", async () => {
    await using screen = await render(<Slate over={null} />);
    const slate = screen.container.querySelector<HTMLElement>('[data-testid="slate"]')!;
    const pane = (id: string) =>
      screen.container.querySelector<HTMLElement>(`[data-stemcells-pane="${id}"]`)!;
    const scale = (id: string) =>
      getComputedStyle(screen.container.querySelector<HTMLElement>(`[data-testid="stack-${id}"]`)!)
        .scale;

    slate.dispatchEvent(new DragEvent("dragenter", { bubbles: true }));
    await screen.rerender(<Slate over="a" />);
    await nextFrame();
    await nextFrame();
    expect(pane("a").hasAttribute("data-landing")).toBe(true);
    expect(pane("b").hasAttribute("data-landing")).toBe(false);
    expect(scale("a")).toBe("1.01");
    expect(scale("b")).toBe("none");

    await screen.rerender(<Slate over="b" />);
    await nextFrame();
    await nextFrame();
    expect(pane("a").hasAttribute("data-landing")).toBe(false);
    expect(pane("b").hasAttribute("data-landing")).toBe(true);

    await screen.rerender(<Slate over={null} />);
    window.dispatchEvent(new DragEvent("drop"));
    await nextFrame();
    await nextFrame();
    expect(pane("b").hasAttribute("data-landing")).toBe(false);
    expect(scale("b")).toBe("none");
  });
});
