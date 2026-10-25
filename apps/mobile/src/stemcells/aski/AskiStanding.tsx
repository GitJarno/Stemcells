// Aski standing in a new chat, over its headline, as on the Mac (`apps/web/
// src/stemcells/aski/AskiStanding.tsx`): what you write here, Aski carries
// into a Cell. Once it's sent, the Cell forms on its ledge out of Aski's
// characters (`cell/forming.ts`). T3's draft hands control here at its seam
// (`features/threads/NewTaskDraftScreen.tsx`, `stemcells/seams.md`).

import { Platform, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { AskiFigure } from "./AskiFigure";

export function AskiStanding() {
  const ink = useResolveClassNames("text-foreground").color;
  // The chat's own ground, which Android draws in the thread's canvas (`ThreadScreenHost.tsx`).
  const ground = useResolveClassNames(
    Platform.OS === "android" ? "bg-thread-canvas" : "bg-screen",
  ).backgroundColor;
  return (
    <View className="mb-5 items-center">
      <AskiFigure height={72} ink={ink} ground={ground} />
    </View>
  );
}
