import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

import { useComposed } from "./compose";

const drawn = new Map<string, boolean>();

function Figure(props: { readonly name: string; readonly look: string }) {
  drawn.set(
    props.name,
    useComposed(props.look, () => {}),
  );
  return null;
}

/** The queue's timer firing after React commits a row, before the row's effects run. */
function QueueRuns() {
  useLayoutEffect(() => {
    vi.runOnlyPendingTimers();
  });
  return null;
}

it("draws each Cell once its look is composed, one rendered just before it finished too", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Figure name="first" look="bare|asleep" />));
  await act(async () =>
    root.render(
      <>
        <Figure name="first" look="bare|asleep" />
        <Figure name="second" look="bare|asleep" />
        <QueueRuns />
      </>,
    ),
  );
  expect(Object.fromEntries(drawn)).toEqual({ first: true, second: true });
  act(() => root.unmount());
  vi.useRealTimers();
});
