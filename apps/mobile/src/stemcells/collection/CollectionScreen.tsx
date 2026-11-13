// Settings › Collection on the phone, as the Mac's (`apps/web/src/stemcells/collection/
// CollectionSettings.tsx`): one machine's feats, and the wardrobe they fill. Two views of one
// read, the feats first (`FeatsView`); the wardrobe is where a Cell is dressed and shows an act
// (`Wardrobe`).

import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { needsConnectionOf } from "../line/readings";
import {
  AppText,
  ScreenScrollView,
  SettingsScreen,
  SymbolView,
  useMachines,
} from "../upstream/disk";
import { useSavedRemoteConnections } from "../upstream/push";
import { FeatsView } from "./FeatsView";
import { COLLECTION } from "./kit";
import { Chip } from "./parts";
import { readCollectionOf, useCollections } from "./read";
import { Wardrobe } from "./Wardrobe";

type Machine = ReturnType<typeof useMachines>[number];

const VIEWS = ["feats", "wardrobe"] as const;
type View_ = (typeof VIEWS)[number];
const VIEW_NAMES: Readonly<Record<View_, string>> = {
  feats: COLLECTION.featsTab,
  wardrobe: COLLECTION.cellsTab,
};

export function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const machines = useMachines();
  const collections = useCollections();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<View_>("feats");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read each machine's collection as the screen opens, and again once a route hands the phone its token.
  useEffect(() => {
    for (const saved of Object.values(savedConnectionsById))
      void readCollectionOf(saved.environmentId, needsConnectionOf(saved), Date.now(), fetch, true);
  }, [savedConnectionsById]);

  const having = machines.filter(
    (machine) => machine.connection === "connected" && collections.has(machine.environmentId),
  );
  const shown = having.find((machine) => machine.environmentId === picked) ?? having[0];
  const collection = shown === undefined ? undefined : collections.get(shown.environmentId);
  const saved = Object.values(savedConnectionsById).find(
    (each) => each.environmentId === shown?.environmentId,
  );
  const connection = saved === undefined ? null : needsConnectionOf(saved);
  return (
    <SettingsScreen title={COLLECTION.title}>
      <ScreenScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: Math.max(insets.bottom, 18) }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4 pb-[18px]"
      >
        {shown === undefined || collection === undefined ? (
          <AppText className="px-2 text-sm text-foreground-muted">{COLLECTION.reading}</AppText>
        ) : (
          <>
            {having.length > 1 ? (
              <MachinePicker machines={having} shown={shown.environmentId} onPick={setPicked} />
            ) : null}
            <View className="flex-row gap-2" accessibilityRole="tablist">
              {VIEWS.map((each) => (
                <Chip
                  key={each}
                  on={each === view}
                  label={VIEW_NAMES[each]}
                  onPress={() => setView(each)}
                >
                  {null}
                </Chip>
              ))}
            </View>
            {view === "feats" ? (
              <FeatsView
                key={`feats:${shown.environmentId}`}
                environmentId={shown.environmentId}
                connection={connection}
                collection={collection}
              />
            ) : (
              <Wardrobe
                key={`room:${shown.environmentId}`}
                environmentId={shown.environmentId}
                connection={connection}
                collection={collection}
              />
            )}
          </>
        )}
      </ScreenScrollView>
    </SettingsScreen>
  );
}

/** The collection is one machine's: with several, which one the screen shows. */
function MachinePicker(props: {
  readonly machines: ReadonlyArray<Machine>;
  readonly shown: string;
  readonly onPick: (environmentId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5 grow-0"
      contentContainerClassName="gap-2 px-5"
    >
      {props.machines.map((machine) => {
        const on = machine.environmentId === props.shown;
        return (
          <Chip
            key={machine.environmentId}
            on={on}
            label={machine.label}
            onPress={() => props.onPick(machine.environmentId)}
          >
            <SymbolView
              name={machine.icon}
              size={16}
              tintColorClassName={on ? "accent-icon" : "accent-icon-muted"}
              type="monochrome"
            />
          </Chip>
        );
      })}
    </ScrollView>
  );
}
