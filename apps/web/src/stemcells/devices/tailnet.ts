import { useEffect, useRef, useState } from "react";

import { openExternal, requestPrimary } from "../upstream/devices";

// A phone's way to this computer over Tailscale, as the server's
// `/api/stemcells/tailscale` says (apps/server/src/stemcells/tailscale/).

export type TailnetStep =
  | { readonly kind: "missing" }
  | { readonly kind: "stopped" }
  | { readonly kind: "signed-out" }
  | { readonly kind: "starting" }
  | { readonly kind: "https-off" }
  | { readonly kind: "not-serving" }
  | { readonly kind: "port-taken"; readonly port: number }
  | { readonly kind: "ready"; readonly baseUrl: string };

export interface TailnetPhone {
  readonly name: string;
  /** Its Tailscale is on: it reaches this computer's tailnet name. */
  readonly online: boolean;
}

export interface TailnetLook {
  readonly step: TailnetStep;
  readonly on: boolean;
  /** The account this computer's Tailscale is signed in with. */
  readonly account: string | null;
  /** The tailnet's phones and tablets. */
  readonly phones: ReadonlyArray<TailnetPhone>;
}

const TAILSCALE_PATH = "/api/stemcells/tailscale";
/** While a step waits on the person (a click in Tailscale), how often it's read again. */
const WATCH_EVERY_MS = 2_000;

async function ask<T>(method: "GET" | "POST", pathname: string): Promise<T | null> {
  try {
    const response = await requestPrimary(method, pathname);
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface TailnetAdvance extends TailnetLook {
  /** A page for the person to finish the step on, opened by the caller. */
  readonly open: string | null;
  /** The Tailscale app came forward: the step waits in its window. */
  readonly openedApp: boolean;
}

export const advanceTailnet = () => ask<TailnetAdvance>("POST", `${TAILSCALE_PATH}/advance`);
export const turnOffTailnet = () => ask<TailnetLook>("POST", `${TAILSCALE_PATH}/off`);

/**
 * The way in now: read on mount, when the window comes back, and every
 * couple of seconds while `watch` and not yet ready, or ready with no phone
 * on the tailnet (the person is clicking through Tailscale, here or on the
 * phone). While watched, what needs nobody is done
 * on arrival, once: Serve put in front of this server, or a way in that's
 * already there kept on. A page that step names opens.
 * `look` is null until the first read, or on a server without the route.
 */
export function useTailnet(watch: boolean) {
  const [look, setLook] = useState<TailnetLook | null>(null);
  /** The automatic Serve ran and left the step where it was. */
  const [serveFailed, setServeFailed] = useState(false);
  const ready = look?.step.kind === "ready";
  const phoneOnline = look?.phones.some((phone) => phone.online) === true;
  const readNow = useRef<() => void>(() => undefined);

  useEffect(() => {
    let stopped = false;
    let served = false;
    // One read at a time: the server takes them in turn, behind a step that can run for seconds.
    let inFlight = false;
    const readOnce = async () => {
      const next = await ask<TailnetLook>("GET", TAILSCALE_PATH);
      if (stopped || next === null) return;
      const arrived = next.step.kind === "not-serving" || (next.step.kind === "ready" && !next.on);
      if (watch && arrived && !served) {
        served = true;
        const after = await advanceTailnet();
        if (stopped) return;
        if (after?.open) void openExternal(after.open);
        setLook(after ?? next);
        setServeFailed((after ?? next).step.kind === "not-serving");
        return;
      }
      setLook(next);
    };
    const read = async () => {
      if (inFlight) return;
      inFlight = true;
      await readOnce();
      inFlight = false;
    };
    const onFocus = () => void read();
    readNow.current = onFocus;
    void read();
    window.addEventListener("focus", onFocus);
    const timer =
      watch && (!ready || !phoneOnline) ? setInterval(onFocus, WATCH_EVERY_MS) : undefined;
    return () => {
      stopped = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [watch, ready, phoneOnline]);

  return { look, setLook, serveFailed, readAgain: () => readNow.current() };
}
