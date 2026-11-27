// The preview's switch on the phone, under the wardrobe as the Mac's (`CollectionSettings.tsx`):
// whether the Cell heading a chat is drawn from its model (`cell/modelPreview.ts`).

import { View } from "react-native";

import { setCellModelOn, useCellModelOn } from "../cell/modelPreview";
import { AppText } from "../upstream/disk";
import { ThemedSwitch } from "../upstream/machineSettings";
import { COLLECTION } from "./kit";
import { Section } from "./parts";

export function NewBody() {
  const on = useCellModelOn();
  return (
    <Section title={COLLECTION.preview}>
      <View className="flex-row items-center gap-3 rounded-2xl bg-grouped-card p-4">
        <View className="min-w-0 flex-1 gap-1">
          <AppText className="text-base font-t3-medium text-foreground">
            {COLLECTION.newBody}
          </AppText>
          <AppText className="text-sm text-foreground-muted">{COLLECTION.newBodyWhatPhone}</AppText>
        </View>
        <ThemedSwitch
          accessibilityLabel={COLLECTION.newBody}
          value={on}
          onValueChange={setCellModelOn}
        />
      </View>
    </Section>
  );
}
