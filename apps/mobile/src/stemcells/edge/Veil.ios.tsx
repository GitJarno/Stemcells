// An edge of the screen where content scrolls under the header or the composer: the page blurs,
// heaviest at the screen's edge and clear by the chrome's inner side, with nothing painted over
// it (`modules/stemcells-edge`). It covers what a scrim with the same props would; an app built
// before the blur gets that scrim.

import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentProps } from "react";
import type { ViewProps } from "react-native";

import { Scrim } from "./Scrim";

function resolveNativeVeil() {
  try {
    const module = requireOptionalNativeModule<{
      readonly ViewPrototypes?: { readonly StemcellsEdge_Veil?: unknown };
    }>("StemcellsEdge");
    if (!module?.ViewPrototypes?.StemcellsEdge_Veil) return null;
    return requireNativeView<ViewProps & { readonly edge: "top" | "bottom" }>(
      "StemcellsEdge",
      "Veil",
    );
  } catch {
    return null;
  }
}

const NativeVeil = resolveNativeVeil();

export function Veil(props: ComponentProps<typeof Scrim>) {
  if (NativeVeil === null) return <Scrim {...props} />;
  const beyond = props.beyond ?? 0;
  const far = props.edge === "top" ? "bottom" : "top";
  return (
    <NativeVeil
      edge={props.edge}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [props.edge]: -beyond,
        ...(props.solid === undefined
          ? { [far]: -(props.over ?? 0) }
          : { height: beyond + props.solid + props.fade }),
      }}
    />
  );
}
