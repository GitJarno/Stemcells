// The home as the screen in front or under a chat, for what it draws (`state.ts`).

import type { ReactNode } from "react";

import { HomeCellsHeld, HomeInFront } from "./state";

export function HomeFront(props: { readonly inFront: boolean; readonly children: ReactNode }) {
  return (
    <HomeInFront value={props.inFront}>
      <HomeCellsHeld value={!props.inFront}>{props.children}</HomeCellsHeld>
    </HomeInFront>
  );
}
