// Add to Chat, as the original app's card has it: a sheet of the newest photos, camera first, where a
// tap picks a photo in order and a second tap lets it go. "Add N" puts them in the composer in
// that order through T3's own picking (`staged.ts`). Leaving by another door (the camera,
// Files, the system's picker) adds what's picked first, so nothing chosen drops.

import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { FormSheet } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import {
  AppText,
  formSheetDetents,
  GlassSurface,
  IconButton,
  SymbolView,
} from "../upstream/attach";
import { type Access, accessTo, chooseMore, onLibraryChange, photoOf, photosFrom } from "./library";
import { GO, numberOf, toggle } from "./picks";
import { pickingThese } from "./staged";

/** Photos asked of the library at a time. */
const PAGE = 90;
/** The squares' hairline. */
const GAP = 2;
/** The bar's height: a source, or the Add pill. */
const BAR = 56;
/** How long the Add pill says the cap after a refused tap, ms. */
const SAYS_CAP_FOR = 1600;
const CAP = `Up to ${GO} at a time`;

/**
 * What the last card showed: the access the person gave and the newest page.
 * The card opens on them and asks the library again behind them, so its
 * photos are there as it comes up rather than popping in after it.
 */
const lastSeen: { access: Access | null; ids: readonly string[] } = { access: null, ids: [] };

type Tile =
  | { readonly kind: "camera" }
  | { readonly kind: "more" }
  | { readonly kind: "photo"; readonly id: string };

export function AttachCard(props: {
  readonly open: boolean;
  /** The card goes down, by a tap or a swipe. */
  readonly onClose: () => void;
  readonly supportsFiles: boolean;
  /** T3's photo picking: the staged photos, else the system's picker. */
  readonly onPickMedia: () => Promise<void>;
  readonly onPickFiles: () => Promise<void>;
}) {
  const sheet = useResolveClassNames("bg-sheet");
  // What to do once the card is down: UIKit presents nothing over a sheet still leaving.
  const after = useRef<(() => Promise<void>) | null>(null);
  const [shown, setShown] = useState(false);
  if (props.open && !shown) setShown(true);

  const leave = (then: () => Promise<void>) => {
    after.current = then;
    props.onClose();
  };

  return (
    <FormSheet
      isOpen={props.open}
      detents={formSheetDetents(0.62)}
      prefersGrabberVisible
      nativeContainerStyle={sheet}
      onNativeDismiss={props.onClose}
      onDidDisappear={() => {
        // A sheet of the system's over the card (Choose more) can report it gone while it stays.
        if (props.open) return;
        setShown(false);
        const then = after.current;
        after.current = null;
        if (then === null) return;
        then().catch((error: unknown) =>
          Alert.alert("Couldn't add that", error instanceof Error ? error.message : "Try again."),
        );
      }}
    >
      {shown ? <Card {...props} leave={leave} /> : null}
    </FormSheet>
  );
}

function Card(props: {
  readonly onClose: () => void;
  readonly supportsFiles: boolean;
  readonly onPickMedia: () => Promise<void>;
  readonly onPickFiles: () => Promise<void>;
  readonly leave: (then: () => Promise<void>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [access, setAccess] = useState<Access | null>(lastSeen.access);
  const [ids, setIds] = useState<readonly string[]>(lastSeen.ids);
  const [more, setMore] = useState(true);
  const [picks, setPicks] = useState<readonly string[]>([]);
  // The sheet is the window's width on a phone: its first frame lays out at
  // that, until its own layout says otherwise.
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const [sayingCap, setSayingCap] = useState(false);
  const list = useRef<FlatList<Tile>>(null);
  const loading = useRef(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shake = useSharedValue(0);
  const reduced = useReducedMotion();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Ask for photo access and load the newest page once; drop late answers and the cap timer on unmount.
  useEffect(() => {
    let live = true;
    void (async () => {
      const granted = await accessTo(true);
      lastSeen.access = granted;
      if (!live) return;
      setAccess(granted);
      if (granted !== "all" && granted !== "limited") {
        lastSeen.ids = [];
        setIds([]);
        return;
      }
      const page = await photosFrom(0, PAGE);
      lastSeen.ids = page;
      if (!live) return;
      setIds(page);
      setMore(page.length === PAGE);
    })();
    return () => {
      live = false;
      clearTimeout(capTimer.current);
    };
  }, []);
  // New photos, or more chosen under limited access: the newest page again.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to photo library changes and unsubscribe on unmount.
  useEffect(
    () =>
      onLibraryChange(() => {
        void photosFrom(0, PAGE).then((page) => {
          lastSeen.ids = page;
          setIds(page);
          setMore(page.length === PAGE);
        });
      }),
    [],
  );

  /** The library's photos from `from` on, after those shown. */
  const load = async (from: number) => {
    if (loading.current) return;
    loading.current = true;
    // `.finally`, not `try`: React Compiler can't compile a `try` without a `catch`.
    const page = await photosFrom(from, PAGE).finally(() => {
      loading.current = false;
    });
    // A photo arriving meanwhile shifts the pages, so one may come again.
    setIds((shown) => {
      const known = new Set(shown);
      return [...shown, ...page.filter((id) => !known.has(id))];
    });
    setMore(page.length === PAGE);
  };

  const add = async (picked: readonly string[]) => {
    if (picked.length === 0) return;
    const read = await Promise.allSettled(picked.map(photoOf));
    const photos = read.flatMap((photo) => (photo.status === "fulfilled" ? [photo.value] : []));
    if (photos.length < picked.length) {
      Alert.alert("Couldn't add every photo", "One or more couldn't be read from the library.");
    }
    if (photos.length > 0) await pickingThese(photos, props.onPickMedia);
  };
  const thenAdd = (door: () => Promise<void>) => {
    const picked = picks;
    props.leave(async () => {
      await add(picked);
      await door();
    });
  };

  const sees = access === "all" || access === "limited";
  const tiles: Tile[] = [
    { kind: "camera" },
    ...(access === "limited" ? [{ kind: "more" } as const] : []),
    ...ids.map((id) => ({ kind: "photo", id }) as const),
  ];
  const size = width > 0 ? (width - 2 * GAP) / 3 : 0;
  const full = picks.length >= GO;

  /** A tap on a dimmed photo: the Add pill shakes its head and says the cap for a moment. */
  const refuse = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    AccessibilityInfo.announceForAccessibility(CAP);
    if (!reduced) {
      shake.set(withSequence(...[6, -6, 4, -4, 0].map((x) => withTiming(x, { duration: 60 }))));
    }
    setSayingCap(true);
    clearTimeout(capTimer.current);
    capTimer.current = setTimeout(() => setSayingCap(false), SAYS_CAP_FOR);
  };
  const tap = (id: string) => {
    const next = toggle(picks, id);
    if (next.toggled === "full") return refuse();
    void Haptics.selectionAsync();
    setPicks(next.picks);
  };

  return (
    <View
      className="flex-1 bg-sheet"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View className="flex-row items-center px-3 pb-2 pt-4">
        <IconButton
          variant="tonal"
          icon="xmark"
          accessibilityLabel="Close"
          onPress={props.onClose}
        />
        <AppText className="flex-1 text-center text-[17px] font-semibold text-foreground">
          {access === "none" ? "Photos" : "Recents"}
        </AppText>
        <IconButton
          variant="tonal"
          icon="magnifyingglass"
          accessibilityLabel="All photos"
          onPress={() => thenAdd(props.onPickMedia)}
        />
      </View>
      {size > 0 ? (
        <FlatList
          ref={list}
          data={tiles}
          numColumns={3}
          keyExtractor={(tile) => (tile.kind === "photo" ? tile.id : tile.kind)}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={Hairline}
          contentContainerStyle={{ paddingBottom: BAR + insets.bottom + 24 }}
          initialNumToRender={24}
          windowSize={7}
          removeClippedSubviews
          onEndReachedThreshold={1.5}
          onEndReached={() => {
            if (sees && more) void load(ids.length);
          }}
          ListFooterComponent={access === "none" ? <NoAccess /> : undefined}
          renderItem={({ item }) =>
            item.kind === "camera" ? (
              <Door
                size={size}
                symbol="camera"
                title="Camera"
                onPress={() => thenAdd(takePhoto(props.onPickMedia))}
              />
            ) : item.kind === "more" ? (
              <Door
                size={size}
                symbol="plus"
                title="Choose more"
                onPress={() => void chooseMore()}
              />
            ) : (
              <PhotoTile
                id={item.id}
                size={size}
                number={numberOf(picks, item.id)}
                dimmed={full}
                onPress={() => tap(item.id)}
              />
            )
          }
        />
      ) : null}
      <Bar
        picks={picks.length}
        sayingCap={sayingCap}
        shake={shake}
        supportsFiles={props.supportsFiles}
        bottom={insets.bottom}
        onPhotos={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
        onFiles={() => thenAdd(props.onPickFiles)}
        onAdd={() => thenAdd(async () => {})}
      />
    </View>
  );
}

/** The camera, as the system presents it; what it takes goes through T3's picking like a picked photo. */
function takePhoto(pickMedia: () => Promise<void>) {
  return async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    if (!camera.granted) {
      Alert.alert(
        "The camera is off for this app",
        "Turn it on in Settings to take a photo here.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (!shot.canceled) await pickingThese(shot.assets, pickMedia);
  };
}

function Hairline() {
  return <View style={{ height: GAP }} />;
}

/** A door on the grid (the camera; "Choose more" under limited access): a square, its symbol over its word. */
function Door(props: {
  readonly size: number;
  readonly symbol: "camera" | "plus";
  readonly title: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.title}
      onPress={props.onPress}
      className="items-center justify-center gap-2 bg-card active:opacity-70"
      style={{ width: props.size, height: props.size }}
    >
      <SymbolView
        name={props.symbol}
        size={26}
        weight="light"
        tintColorClassName="accent-foreground"
      />
      <AppText className="text-[13px] font-medium text-foreground" numberOfLines={1}>
        {props.title}
      </AppText>
    </Pressable>
  );
}

/** One photo: its picture, square, from the library at the size it's drawn (kept in memory only), and its ring. */
function PhotoTile(props: {
  readonly id: string;
  readonly size: number;
  readonly number: number | undefined;
  /** The go is full and this one isn't in it. */
  readonly dimmed: boolean;
  readonly onPress: () => void;
}) {
  const picked = props.number !== undefined;
  const dimmed = props.dimmed && !picked;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Photo"
      accessibilityState={{ selected: picked }}
      accessibilityValue={picked ? { text: `Picked, ${props.number}` } : undefined}
      accessibilityHint={dimmed ? CAP : undefined}
      onPress={props.onPress}
      className="bg-card active:opacity-70"
      style={{ width: props.size, height: props.size, opacity: dimmed ? 0.4 : 1 }}
    >
      <Image
        source={{ uri: props.id }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={props.id}
        cachePolicy="memory"
        transition={120}
      />
      {picked ? <View className="absolute inset-0 bg-black/25" /> : null}
      <View
        className={
          picked
            ? "absolute right-2 top-2 size-6 items-center justify-center rounded-full bg-primary"
            : "absolute right-2 top-2 size-6 rounded-full border-[1.5px] border-white/90 bg-black/10"
        }
      >
        {picked ? (
          <AppText className="text-[13px] font-semibold text-primary-foreground">
            {props.number}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The bar at the card's foot. At rest: the sources, Photos lit (a tap
 * scrolls back to the newest). With photos picked: Files steps down to its
 * ring and "Add N" takes the row; a refused tap shakes it and it says the
 * cap for a moment.
 */
function Bar(props: {
  readonly picks: number;
  readonly sayingCap: boolean;
  readonly shake: SharedValue<number>;
  readonly supportsFiles: boolean;
  readonly bottom: number;
  readonly onPhotos: () => void;
  readonly onFiles: () => void;
  readonly onAdd: () => void;
}) {
  const { shake } = props;
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 flex-row gap-3 px-4"
      style={{ paddingBottom: Math.max(props.bottom, 16) }}
    >
      {props.picks === 0 ? (
        <GlassSurface className="flex-row self-center p-1" style={{ borderRadius: BAR / 2 }}>
          <Source symbol="photo" title="Photos" lit onPress={props.onPhotos} />
          {props.supportsFiles ? (
            <Source symbol="folder" title="Files" onPress={props.onFiles} />
          ) : null}
        </GlassSurface>
      ) : (
        <>
          {props.supportsFiles ? (
            <GlassSurface style={{ width: BAR, height: BAR, borderRadius: BAR / 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Files"
                onPress={props.onFiles}
                className="flex-1 items-center justify-center active:opacity-70"
              >
                <SymbolView name="folder" size={20} tintColorClassName="accent-foreground" />
              </Pressable>
            </GlassSurface>
          ) : null}
          <Animated.View className="flex-1" style={shaking}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.picks === 1 ? "Add 1 photo" : `Add ${props.picks} photos`}
              accessibilityValue={props.sayingCap ? { text: CAP } : undefined}
              onPress={props.onAdd}
              className="items-center justify-center rounded-full bg-primary active:opacity-80"
              style={{ height: BAR }}
            >
              <AppText
                className="text-[17px] font-semibold text-primary-foreground"
                numberOfLines={1}
              >
                {props.sayingCap ? CAP : `Add ${props.picks}`}
              </AppText>
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

/** One source on the bar: its symbol over its word; the lit one, where you are, on a pill of light. */
function Source(props: {
  readonly symbol: "photo" | "folder";
  readonly title: string;
  readonly lit?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.title}
      accessibilityState={{ selected: props.lit === true }}
      onPress={props.onPress}
      className={
        props.lit === true
          ? "min-w-20 items-center justify-center rounded-full bg-subtle px-4"
          : "min-w-20 items-center justify-center rounded-full px-4 active:opacity-70"
      }
      style={{ height: BAR - 8 }}
    >
      <SymbolView
        name={props.symbol}
        size={19}
        tintColorClassName={props.lit === true ? "accent-foreground" : "accent-icon-muted"}
      />
      <AppText
        className={
          props.lit === true
            ? "text-[12px] font-semibold text-foreground"
            : "text-[12px] font-semibold text-foreground-muted"
        }
      >
        {props.title}
      </AppText>
    </Pressable>
  );
}

/** Photos are off: the card says so and where to turn them on; the magnifier still reaches every photo. */
function NoAccess() {
  return (
    <View className="mx-4 mt-6 gap-1 rounded-2xl bg-card p-5">
      <AppText className="text-[15px] font-medium text-foreground">
        Photos are off for this app
      </AppText>
      <AppText className="text-[13px] text-foreground-muted">
        The magnifier still reaches every photo, or turn access on in Settings.
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openSettings()}
        className="mt-2 self-start active:opacity-70"
      >
        <AppText className="text-[15px] font-medium text-primary">Open Settings</AppText>
      </Pressable>
    </View>
  );
}
