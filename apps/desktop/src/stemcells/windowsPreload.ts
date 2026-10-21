/**
 * Stemcells: hands the page its window (`window.stemcellsWindows`, read by
 * apps/web/src/stemcells/windows/bridge.ts): who it is and the workspace it
 * starts from, read synchronously before the page's scripts run, and the
 * way to publish its workspace, take one a move gave it, and make moves
 * (stemcells/tasks/windows.md).
 */
import { contextBridge, ipcRenderer } from "electron";

import {
  WINDOWS_CHANNEL,
  type FlightCommand,
  type FlightRect,
  type WindowBoot,
  type WindowElsewhere,
} from "./windows/channels.ts";

function readBoot(): WindowBoot | null {
  try {
    const boot: unknown = ipcRenderer.sendSync(WINDOWS_CHANNEL.boot);
    if (typeof boot !== "object" || boot === null) return null;
    return typeof (boot as WindowBoot).id === "string" ? (boot as WindowBoot) : null;
  } catch {
    return null;
  }
}

const boot = readBoot();

if (boot !== null) {
  const adoptListeners = new Set<(workspace: unknown) => void>();
  // A workspace that came before the page listened: it's the one to start from.
  let waiting: { readonly workspace: unknown } | null = null;

  const adopt = (workspace: unknown) => {
    for (const listener of adoptListeners) listener(workspace);
    ipcRenderer.send(WINDOWS_CHANNEL.adopted);
  };

  ipcRenderer.on(WINDOWS_CHANNEL.adopt, (_event, workspace: unknown) => {
    if (adoptListeners.size === 0) waiting = { workspace };
    else adopt(workspace);
  });

  const listen = <T>(channel: string) => {
    const listeners = new Set<(value: T) => void>();
    ipcRenderer.on(channel, (_event, value: T) => {
      for (const listener of listeners) listener(value);
    });
    return (listener: (value: T) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
  };

  contextBridge.exposeInMainWorld("stemcellsWindows", {
    boot,
    publish: (workspace: unknown) => ipcRenderer.send(WINDOWS_CHANNEL.publish, workspace),
    snapshot: () => ipcRenderer.invoke(WINDOWS_CHANNEL.snapshot),
    commit: (transaction: unknown) => ipcRenderer.invoke(WINDOWS_CHANNEL.commit, transaction),
    onAdopt: (listener: (workspace: unknown) => void) => {
      adoptListeners.add(listener);
      if (waiting !== null) {
        const { workspace } = waiting;
        waiting = null;
        adopt(workspace);
      }
      return () => void adoptListeners.delete(listener);
    },
    onLead: listen<boolean>(WINDOWS_CHANNEL.lead),
    onClosed: listen<unknown>(WINDOWS_CHANNEL.closed),
    onReturned: listen<unknown>(WINDOWS_CHANNEL.returned),
    onElsewhere: listen<WindowElsewhere>(WINDOWS_CHANNEL.elsewhere),
    onFocusPane: listen<string>(WINDOWS_CHANNEL.focusPane),
    onNotifies: listen<boolean>(WINDOWS_CHANNEL.notifies),
    reveal: (window: string, pane: string) =>
      ipcRenderer.send(WINDOWS_CHANNEL.reveal, { window, pane }),
    flight: (commands: ReadonlyArray<FlightCommand>) =>
      ipcRenderer.send(WINDOWS_CHANNEL.flight, commands),
    still: (rect: FlightRect) => ipcRenderer.invoke(WINDOWS_CHANNEL.flightStill, rect),
    painted: () => ipcRenderer.invoke(WINDOWS_CHANNEL.flightPainted),
    endFlight: () => ipcRenderer.send(WINDOWS_CHANNEL.flightEnd),
    drawn: () => ipcRenderer.send(WINDOWS_CHANNEL.drawn),
    onLanded: listen<string>(WINDOWS_CHANNEL.landed),
  });
}
