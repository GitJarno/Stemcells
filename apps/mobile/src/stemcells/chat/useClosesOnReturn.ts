// A chat whose Cell the person settled on another device while the phone was away shows the home
// once the app is back (stemcells/tasks/settle-everywhere.md). Never while it is in front: only on
// the app's return, for as long as its machine takes to answer while the route reconnects.

import { useNavigation } from "@react-navigation/native";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AppState } from "react-native";

import { readNeeds, type Reading } from "../line/read";
import { needsConnectionOf } from "../line/readings";
import { useShowHome } from "../upstream/home";
import { useSavedConnection } from "../upstream/push";
import { closesOnReturn } from "./closesOnReturn";
import type { ChatRef } from "./inView";

/** How long after the app's return its machine's answer may still close the chat. */
const RETURN_MS = 10_000;

interface Return {
  /** When the app went to the background. */
  readonly awaySince: number;
  /** When it came back to the front. */
  readonly at: number;
}

export function useClosesOnReturn(chat: ChatRef): void {
  const navigation = useNavigation();
  const showHome = useShowHome();
  const connection = useSavedConnection(chat.environmentId);
  const awaySince = useRef<number | null>(null);
  const [back, setBack] = useState<Return | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follow React Native's AppState: when the app leaves, and when it comes back; remove the listener on unmount.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") awaySince.current ??= Date.now();
      else if (next === "active" && awaySince.current !== null) {
        setBack({ awaySince: awaySince.current, at: Date.now() });
        awaySince.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const answered = useEffectEvent((reading: Reading, from: Return) => {
    const late = Date.now() - from.at > RETURN_MS;
    // Out of reach while its route reconnects: the token it comes back with reads it again.
    if (reading.state === "unreachable" && !late) return;
    setBack(null);
    // The chat in front on the app's own stack, not one previewed beside another.
    const inFront =
      navigation.isFocused() &&
      navigation.getState()?.routes.some((route) => route.name === "Home") === true;
    if (
      reading.state === "read" &&
      !late &&
      inFront &&
      closesOnReturn({
        shown: chat.threadId,
        awaySince: from.awaySince,
        settles: reading.list.settles,
      })
    )
      showHome();
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the chat's machine once the app is back, again each time its route changes while that read waits.
  useEffect(() => {
    if (back === null || connection === null) return;
    let current = true;
    void readNeeds(needsConnectionOf(connection), null).then((reading) => {
      if (current) answered(reading, back);
    });
    return () => {
      current = false;
    };
  }, [back, connection]);
}
