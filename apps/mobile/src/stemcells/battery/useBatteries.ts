import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useMinute } from "../home/state";
import { useDeadlinePassed, useMachineSnapshots } from "../upstream/battery";
import { useMachines } from "../upstream/disk";
import { AWAY_AFTER_MS, isAway, keptCharges, type MachineBattery } from "./marks";

const kept = keptCharges();

let frontSince = Date.now();
const listeners = new Set<() => void>();
AppState.addEventListener("change", (next) => {
  if (next !== "active") return;
  frontSince = Date.now();
  for (const listener of listeners) listener();
});
const onFront = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Every machine with a battery the phone has heard of this run, by name. */
export function useBatteries(): ReadonlyArray<MachineBattery> {
  const machines = useMachines();
  const snapshots = useMachineSnapshots(
    machines
      .filter((machine) => machine.connection === "connected")
      .map((machine) => String(machine.environmentId)),
  );
  const since = useSyncExternalStore(onFront, () => frontSince);
  const settled = useDeadlinePassed(since + AWAY_AFTER_MS);
  const now = Date.parse(useMinute());
  return machines
    .flatMap((machine) => {
      const environmentId = String(machine.environmentId);
      const heard = kept(
        environmentId,
        snapshots.find((each) => each.environmentId === environmentId)?.snapshot,
        now,
      );
      if (heard === null) return [];
      const connected = machine.connection === "connected";
      const away = isAway(connected, settled, heard.heardAt, now);
      return [{ ...heard, environmentId, label: machine.label, away }];
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
