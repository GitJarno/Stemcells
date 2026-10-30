// On the home's tabs Settled reads its older Cells as the person scrolls toward its end, with a
// quiet row while a page is on its way, where T3's list asks for a tap on "Show more"
// (`features/home/HomeScreen.tsx`, at its seam). T3's own home, searching too, keeps its button.

import { use } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { readsNextPage } from "../line/line";
import { AppText } from "../upstream/cells";
import { HomeTabsContext } from "./state";

/** A screen ahead of the end, so the next page is mostly in before the person gets there. */
const SCREENS_AHEAD = 1;

/** The list's footer and end-reached props on the home's tabs; none elsewhere. */
export function useSettledPages(input: {
  /** Settled Cells past the list's end: 0 while its shelf is shut. */
  readonly hidden: number;
  readonly shelf: {
    readonly loading: boolean;
    readonly failed: boolean;
    readonly retry: () => void;
  };
  readonly showMore: () => void;
}) {
  if (use(HomeTabsContext) === null) return {};
  const { hidden, shelf } = input;
  return {
    ListFooterComponent:
      hidden === 0 ? null : shelf.loading ? (
        <Loading />
      ) : shelf.failed ? (
        <TryAgain onPress={shelf.retry} />
      ) : null,
    onEndReached: () => {
      if (readsNextPage({ hidden, loading: shelf.loading, failed: shelf.failed })) input.showMore();
    },
    onEndReachedThreshold: SCREENS_AHEAD,
  };
}

function Loading() {
  return (
    <View className="items-center py-4">
      <ActivityIndicator accessibilityLabel="Loading older settled Cells" />
    </View>
  );
}

function TryAgain(props: { readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      className="items-center py-4 active:opacity-70"
    >
      <AppText className="text-xs text-foreground-muted">
        Couldn’t load older Cells. Tap to try again.
      </AppText>
    </Pressable>
  );
}
