// The home as the screen in front or under a chat, for what it draws (`state.ts`), under a
// header with nothing behind it (`upstream/substitutes/NativeScrollViewMarker.tsx`).

import type { ReactNode } from "react";

import { HomeCellsHeld, HomeInFront, NoHeaderBand } from "./state";

export function HomeFront(props: { readonly inFront: boolean; readonly children: ReactNode }) {
  return (
    <HomeInFront value={props.inFront}>
      <NoHeaderBand value>
        <HomeCellsHeld value={!props.inFront}>{props.children}</HomeCellsHeld>
      </NoHeaderBand>
    </HomeInFront>
  );
}
