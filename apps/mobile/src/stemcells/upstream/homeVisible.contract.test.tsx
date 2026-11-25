import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";

// Beside the home, the chat holds the navigator's focus.
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ isFocused: () => false }),
}));

import { useHomeRouteVisible } from "../../features/home/home-route-visibility";

/**
 * Contract: T3 hands its home `visible`, which our home reads as in front (`substitutes/
 * HomeScreen.tsx`). A sidebar column on screen beside a chat is visible though the chat has the
 * focus; were it not, the unfolded Duo's and the iPad's home would hold its Cells still and stop
 * reading its asks.
 */
it("counts the home in a presented sidebar column as on screen, and not once it's gone", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const seen: boolean[] = [];
  function Probe() {
    const visible = useHomeRouteVisible();
    useLayoutEffect(() => void seen.push(visible));
    return null;
  }
  const column = (presented: boolean) => ({
    presented,
    selectedThreadKey: "env:chat",
    selectedPullRequestKey: null,
    selectedIssueKey: null,
  });
  const root = createRoot(document.createElement("div"));
  for (const presented of [true, false])
    act(() =>
      root.render(
        <NativePrimaryColumnContext value={column(presented)}>
          <Probe />
        </NativePrimaryColumnContext>,
      ),
    );
  act(() => root.unmount());
  expect(seen).toEqual([true, false]);
});
