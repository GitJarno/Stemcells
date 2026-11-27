// Android has no variable blur: the edge fades into the ground instead (`Veil.ios.tsx`). No bar
// minimizes over it, so a top veil has none to follow.
import type { ComponentProps } from "react";

import { Scrim } from "./Scrim";

export function Veil(props: ComponentProps<typeof Scrim> & { readonly followsBar?: boolean }) {
  return <Scrim {...props} />;
}
