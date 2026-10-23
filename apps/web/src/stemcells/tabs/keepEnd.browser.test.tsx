// A terminal drawer opening under a chat read to its end shortened the
// transcript, and the words stayed where they were while the composer rose
// with the drawer: upstream's list kept the end a frame later, or gliding
// while a Cell worked. Where the list will keep the end, the pane keeps it
// in the same frame, and does no more than the list would.
import { describe, expect, it } from "vite-plus/test";

import { render } from "../upstream/testRender";
import { isAtEnd, keepEnd } from "./keepEnd";

const SCREEN = 400;
const DRAWER = 200;

/** A pane: a transcript of 40 lines (1600px), and a drawer under it, closed. */
function Pane(props: { follows: boolean }) {
  return (
    <div
      data-stemcells-pane=""
      style={{ display: "flex", flexDirection: "column", height: SCREEN }}
    >
      <div className="messages-timeline-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {Array.from({ length: 40 }, (_, line) => (
          <p key={line} style={{ height: 40, margin: 0 }}>
            {line}
          </p>
        ))}
        {props.follows ? <i hidden data-stemcells-follows="" /> : null}
      </div>
      <div data-drawer="" style={{ height: 0, flexShrink: 0 }} />
    </div>
  );
}

/** Opens the drawer under a transcript `fromEnd` px short of its end; resolves once the pane has seen it. */
async function openDrawer(props: { fromEnd: number; follows?: boolean }) {
  await using stack = new AsyncDisposableStack();
  const screen = stack.use(await render(<Pane follows={props.follows ?? true} />));
  const pane = screen.container.querySelector<HTMLElement>("[data-stemcells-pane]")!;
  const transcript = pane.querySelector<HTMLElement>(".messages-timeline-scroll")!;
  stack.defer(keepEnd(pane));
  transcript.scrollTop = transcript.scrollHeight - SCREEN - props.fromEnd;
  transcript.dispatchEvent(new Event("scroll"));
  const before = transcript.scrollTop;
  pane.querySelector<HTMLElement>("[data-drawer]")!.style.height = `${DRAWER}px`;
  // Observers report in the order they were made: this one, made after the
  // pane's, reports once the pane has acted on the drawer's height.
  await new Promise<void>((resolve) => {
    const seen = new ResizeObserver(() => {
      seen.disconnect();
      resolve();
    });
    seen.observe(transcript);
  });
  expect(transcript.clientHeight).toBe(SCREEN - DRAWER);
  return { stack: stack.move(), transcript, before };
}

describe("a transcript under an opening drawer", () => {
  it("at its end, stays at its end", async () => {
    const { stack, transcript } = await openDrawer({ fromEnd: 0 });
    await using _ = stack;
    expect(isAtEnd(transcript)).toBe(true);
  });

  it("within a screen of its end, comes to its end, where the list would bring it next frame", async () => {
    const { stack, transcript } = await openDrawer({ fromEnd: SCREEN - 100 });
    await using _ = stack;
    expect(isAtEnd(transcript)).toBe(true);
  });

  it("further than a screen from its end, stays where it was", async () => {
    const { stack, transcript, before } = await openDrawer({ fromEnd: SCREEN + 100 });
    await using _ = stack;
    expect(transcript.scrollTop).toBe(before);
  });

  it("while the list doesn't follow its end, is left to it, even at its end", async () => {
    const { stack, transcript, before } = await openDrawer({ fromEnd: 0, follows: false });
    await using _ = stack;
    expect(transcript.scrollTop).toBe(before);
  });
});
