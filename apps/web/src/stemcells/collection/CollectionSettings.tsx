// Settings › Collection: the feats, and the wardrobe they fill. Two views of one read, the
// feats first: a summary, what is next, and a row a ladder (`FeatsView`); the wardrobe is where
// a Cell is dressed and shows an act (`Wardrobe`).

import { useEffect, useState } from "react";

import { COLLECTION } from "../../../../../stemcells/words/feats.ts";
import { useCellGround } from "../upstream/appearance";
import { SettingsPageContainer, Toggle, ToggleGroup } from "../upstream/settings";
import { FeatsView } from "./FeatsView";
import { readCollection, useCollection } from "./read";
import { Wardrobe } from "./Wardrobe";

const VIEWS = ["feats", "wardrobe"] as const;
type View = (typeof VIEWS)[number];
const VIEW_NAMES: Readonly<Record<View, string>> = {
  feats: COLLECTION.featsTab,
  wardrobe: COLLECTION.wardrobe,
};

export function CollectionSettingsPanel() {
  const collection = useCollection();
  const ground = useCellGround();
  const [view, setView] = useState<View>("feats");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the machine's collection as the page opens.
  useEffect(() => {
    void readCollection();
  }, []);
  if (collection === null) {
    return (
      <SettingsPageContainer>
        <p className="text-sm text-muted-foreground">{COLLECTION.reading}</p>
      </SettingsPageContainer>
    );
  }
  return (
    <SettingsPageContainer>
      <ToggleGroup
        aria-label={COLLECTION.title}
        value={[view]}
        onValueChange={(next) => {
          const value = VIEWS.find((each) => each === next[0]);
          if (value !== undefined) setView(value);
        }}
      >
        {VIEWS.map((each) => (
          <Toggle key={each} value={each}>
            {VIEW_NAMES[each]}
          </Toggle>
        ))}
      </ToggleGroup>
      {view === "feats" ? (
        <FeatsView collection={collection} ground={ground} />
      ) : (
        <Wardrobe collection={collection} ground={ground} />
      )}
    </SettingsPageContainer>
  );
}
