import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  createPairingLink,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  formatExpiresInLabel,
  openExternal,
  pairingUrlFor,
  QRCodeSvg,
  reachablePageOrigin,
  refreshRoutes,
  revokePairingLink,
  turnOnNetworkAccess,
  useCopyToClipboard,
  useThisMachine,
} from "../upstream/devices";
import { Button, Spinner, toastManager, useNowSecond } from "../upstream/disk";
import { deviceName, pairedBy } from "./devices";
import { advanceTailnet, type TailnetLook, type TailnetStep, useTailnet } from "./tailnet";
import { wifiRoute } from "./wifiRoute";

// Settings › Your devices › Add › Phone or tablet (stemcells/tasks/devices.md): a one-time link to
// this computer as a QR code, and "Paired" once the phone used it. This computer stays on
// loopback and Tailscale Serve answers for it on the tailnet; the dialog sets that up, opening a
// page where the person's click is needed. Wi-Fi only is the way without Tailscale.

type Link = {
  readonly id: string;
  readonly credential: string;
  readonly expiresAt: string;
  /** The devices paired before this link, so the one it pairs stands out. */
  readonly seen: ReadonlySet<string>;
};

export function AddPhoneDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-sm">
        <AddPhone onDone={() => onOpenChange(false)} />
      </DialogPopup>
    </Dialog>
  );
}

/** The three things a phone's way in over Tailscale needs, in order, and the step each covers. */
const SETUP = [
  {
    title: "Tailscale on this computer",
    steps: ["missing", "stopped", "signed-out", "starting"],
  },
  { title: "HTTPS for your tailnet, once", steps: ["https-off"] },
  { title: "This computer on your tailnet", steps: ["not-serving", "port-taken"] },
] as const satisfies ReadonlyArray<{
  readonly title: string;
  readonly steps: ReadonlyArray<TailnetStep["kind"]>;
}>;

/**
 * What the person reads at each step: the step itself with the button that
 * takes it, then, back on the same step after it, what to do on the page
 * or in the app window that opened, or what went wrong when neither did.
 */
const STEP_COPY: Record<
  Exclude<TailnetStep["kind"], "ready">,
  {
    readonly hint: string;
    readonly action: string | null;
    readonly page?: string;
    readonly app?: string;
    readonly failed: string;
  }
> = {
  missing: {
    hint: "Install Tailscale and sign in.",
    action: "Get Tailscale",
    page: "Install Tailscale from the page that opened, then sign in.",
    failed: "Install Tailscale from tailscale.com, then sign in.",
  },
  stopped: {
    hint: "Tailscale is off.",
    action: "Start Tailscale",
    app: "Turn Tailscale on in its window.",
    failed: "Start Tailscale on this computer.",
  },
  "signed-out": {
    hint: "Sign in to Tailscale.",
    action: "Sign in",
    page: "Sign in on the page that opened.",
    app: "Sign in in Tailscale's window.",
    failed: "Sign in to Tailscale on this computer.",
  },
  starting: { hint: "Tailscale is connecting.", action: null, failed: "Tailscale is connecting." },
  "https-off": {
    hint: "Your tailnet needs HTTPS, once. Tailscale asks you to confirm.",
    action: "Turn on HTTPS",
    page: "Confirm on Tailscale's page. This updates by itself.",
    failed:
      "Tailscale didn't offer its page. Try again; only your tailnet's admin can turn on HTTPS.",
  },
  "not-serving": {
    hint: "Putting this computer on your tailnet.",
    action: null,
    failed: "Tailscale didn't put this computer on your tailnet.",
  },
  "port-taken": {
    hint: "Tailscale's HTTPS port already serves something else on this computer. Give Stemcells another under Tailscale HTTPS in Settings › Sharing & access.",
    action: null,
    failed: "",
  },
};

/**
 * Whether a phone is on the tailnet yet. A code scanned on a phone outside it
 * fails with only a transport error, since the tailnet's name doesn't resolve
 * there, so the step that's the person's, on the phone, is said here and
 * ticks once the phone shows up.
 */
function PhoneOnTailnet({ look }: { readonly look: TailnetLook }) {
  const online = look.phones.filter((phone) => phone.online);
  const offline = look.phones.find((phone) => !phone.online);
  const account = look.account === null ? "" : ` as ${look.account}`;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex items-center gap-2">
        {online.length > 0 ? (
          <CheckIcon aria-hidden className="size-4 text-success" />
        ) : (
          <CircleIcon aria-hidden className="size-4 text-foreground" />
        )}
        {online.length > 0
          ? `${online.map((phone) => phone.name).join(", ")} on your tailnet`
          : "Your phone on your tailnet"}
      </p>
      {online.length > 0 ? null : (
        <p className="text-xs text-muted-foreground">
          {offline !== undefined
            ? `${offline.name} has Tailscale off. Turn it on there, then scan this code.`
            : `On your phone, get Tailscale from the App Store or Google Play, sign in${account} and turn it on. Then scan this code. This updates by itself.`}
        </p>
      )}
    </div>
  );
}

function AddPhone({ onDone }: { readonly onDone: () => void }) {
  const here = useThisMachine();
  const [way, setWay] = useState<"tailnet" | "wifi">("tailnet");
  const tailnet = useTailnet(here.canSwitch && way === "tailnet");
  // A browser away from this computer already reaches it at its page's address.
  const wifi = wifiRoute(
    here.canSwitch
      ? { desktop: true, exposure: here.exposure, endpoints: here.endpoints }
      : { desktop: false, pageOrigin: here.desktop ? null : reachablePageOrigin() },
  );
  const step = tailnet.look?.step ?? null;
  const baseUrl = !here.canSwitch
    ? wifi.kind === "ready"
      ? wifi.baseUrl
      : null
    : way === "tailnet"
      ? step?.kind === "ready"
        ? step.baseUrl
        : null
      : wifi.kind === "ready"
        ? wifi.baseUrl
        : null;

  const [link, setLink] = useState<Link | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The step the last advance was taken from, and whether it opened a page:
   * back on that step, its hint turns to what to do there.
   */
  const [advanced, setAdvanced] = useState<{
    readonly from: TailnetStep["kind"] | null;
    readonly opened: "page" | "app" | null;
  } | null>(null);
  const minting = useRef(false);
  const mounted = useRef(true);
  const unused = useRef<string | null>(null);
  const nowMs = useNowSecond();
  const { copyToClipboard } = useCopyToClipboard({
    onCopy: () =>
      toastManager.add({
        type: "success",
        title: "Link copied",
        description: "Paste it on the other device. It works once, for five minutes.",
      }),
  });

  const ready = baseUrl !== null;
  const devices = here.devices;
  const paired =
    link !== null && devices !== null && here.openLinkIds !== null
      ? pairedBy({ linkId: link.id, seen: link.seen, devices, openLinkIds: here.openLinkIds })
      : null;
  const expired = link !== null && Date.parse(link.expiresAt) <= nowMs;

  // oxlint-disable-next-line t3code/react-effect-budget -- Ask the desktop app for its advertised routes once on open.
  useEffect(() => {
    refreshRoutes();
  }, []);

  // oxlint-disable-next-line t3code/react-effect-budget -- Mint one pairing link once its route and scopes are known.
  useEffect(() => {
    const scopesKnown = here.delegatable.length > 0;
    if (!ready || !here.canPair || !scopesKnown || devices === null) return;
    if (link !== null || problem !== null || minting.current) return;
    minting.current = true;
    const seen = new Set(devices.map((device) => device.sessionId));
    void createPairingLink(here.delegatable)
      .then((created) => {
        // Closed while it was being made: nobody will scan it.
        if (!mounted.current) return revokePairingLink(created.id);
        setLink({ ...created, seen });
      })
      .catch((error: unknown) =>
        setProblem(error instanceof Error ? error.message : "The code couldn't be made."),
      )
      .finally(() => {
        minting.current = false;
      });
  }, [ready, here.canPair, here.delegatable, devices, link, problem]);

  // A link nobody used goes back when the dialog closes, not five minutes later.
  // oxlint-disable-next-line t3code/react-effect-budget -- Mirror the unused link's id for the unmount cleanup.
  useEffect(() => {
    unused.current = link !== null && paired === null && !expired ? link.id : null;
  }, [link, paired, expired]);
  // oxlint-disable-next-line t3code/react-effect-budget -- Revoke the unused pairing link when the dialog unmounts.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (unused.current !== null) void revokePairingLink(unused.current).catch(() => undefined);
    };
  }, []);

  const advance = async () => {
    const from = step?.kind ?? null;
    setBusy(true);
    const next = await advanceTailnet();
    setBusy(false);
    if (!mounted.current) return;
    if (next === null) {
      toastManager.add({
        type: "error",
        title: "Couldn't reach this computer's server",
        description: "Try again in a moment.",
      });
      return;
    }
    tailnet.setLook(next);
    setAdvanced({ from, opened: next.open !== null ? "page" : next.openedApp ? "app" : null });
    if (next.open !== null) void openExternal(next.open);
  };

  const turnOnWifi = async () => {
    setBusy(true);
    try {
      await turnOnNetworkAccess();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Couldn't turn it on",
        description:
          error instanceof Error ? error.message : "Try again from Settings › Sharing & access.",
      });
    }
    setBusy(false);
  };

  if (paired !== null)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Paired</DialogTitle>
          <DialogDescription>
            {deviceName(paired)} reaches this computer now. Remove it here any time.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex justify-center py-4">
            <CheckIcon aria-hidden className="size-10 text-success" />
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );

  if (baseUrl !== null) {
    const url = link === null ? null : pairingUrlFor(baseUrl, link.credential);
    const overWifi = here.canSwitch && way === "wifi";
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add a phone</DialogTitle>
          <DialogDescription>Open Stemcells on your phone and scan this code.</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-col items-center gap-3">
            {!here.canPair ? (
              <p className="text-sm text-muted-foreground">
                This device can&apos;t pair others with this computer.
              </p>
            ) : problem !== null ? (
              <p className="text-sm text-destructive">{problem}</p>
            ) : url === null ? (
              <div className="flex size-58 items-center justify-center">
                <Spinner />
              </div>
            ) : expired ? (
              <div className="flex size-58 items-center justify-center rounded-xl border border-border/60">
                <p className="text-sm text-muted-foreground">This code expired.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-white p-3">
                <QRCodeSvg
                  value={url}
                  size={208}
                  level="M"
                  marginSize={1}
                  title="Pairing code for your phone"
                />
              </div>
            )}
            {link !== null && !expired ? (
              <p className="text-xs text-muted-foreground">
                {new URL(baseUrl).host} · {formatExpiresInLabel(link.expiresAt, nowMs)}
              </p>
            ) : null}
          </div>
          {overWifi ? (
            <p className="text-xs text-muted-foreground">
              This works on this Wi-Fi only. Over Tailscale it reaches this computer from anywhere.
            </p>
          ) : here.canSwitch && tailnet.look !== null ? (
            <PhoneOnTailnet look={tailnet.look} />
          ) : null}
        </DialogPanel>
        <DialogFooter variant="bare">
          {overWifi ? (
            <Button variant="outline" onClick={() => setWay("tailnet")}>
              Use Tailscale
            </Button>
          ) : null}
          {problem !== null || expired ? (
            <Button
              variant="outline"
              onClick={() => {
                setProblem(null);
                setLink(null);
              }}
            >
              New code
            </Button>
          ) : url !== null ? (
            <Button variant="outline" onClick={() => copyToClipboard(url, undefined)}>
              Copy link
            </Button>
          ) : null}
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  if (!here.canSwitch)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add a phone</DialogTitle>
          <DialogDescription>
            Open Settings › Your devices in the Stemcells app on this computer, which sets up the
            way in for your phone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter variant="bare">
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );

  if (way === "wifi")
    return (
      <>
        <DialogHeader>
          <DialogTitle>Wi-Fi only</DialogTitle>
          <DialogDescription>
            A phone on this Wi-Fi reaches this computer, and loses it away from home. Every device
            on the network can then knock, though only a paired one gets in.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {wifi.kind === "loading" ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Stemcells restarts once, and any Cell at work stops. Come back here after.
            </p>
          )}
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="outline" disabled={busy} onClick={() => setWay("tailnet")}>
            Use Tailscale
          </Button>
          <Button disabled={busy || wifi.kind === "loading"} onClick={() => void turnOnWifi()}>
            {busy ? <Spinner size="xs" /> : null}
            Turn on
          </Button>
        </DialogFooter>
      </>
    );

  const current = step === null || step.kind === "ready" ? null : step.kind;
  const copy = current === null ? null : STEP_COPY[current];
  const at =
    current === null ? -1 : SETUP.findIndex((item) => item.steps.some((s) => s === current));
  const waitingOnPerson =
    current !== null &&
    (advanced?.from === current || (current === "not-serving" && tailnet.serveFailed));
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a phone</DialogTitle>
        <DialogDescription>
          Your phone reaches this computer through Tailscale, at home or away. Stemcells sets it up
          here.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        {copy === null ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="flex flex-col gap-2 text-sm">
              {SETUP.map((item, index) => (
                <li key={item.title} className="flex items-center gap-2">
                  {index < at ? (
                    <CheckIcon aria-hidden className="size-4 text-success" />
                  ) : index === at &&
                    (busy ||
                      current === "starting" ||
                      (current === "not-serving" && !waitingOnPerson)) ? (
                    <Spinner size="xs" />
                  ) : (
                    <CircleIcon
                      aria-hidden
                      className={
                        index === at ? "size-4 text-foreground" : "size-4 text-muted-foreground/50"
                      }
                    />
                  )}
                  <span className={index > at ? "text-muted-foreground" : undefined}>
                    {item.title}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              {!waitingOnPerson
                ? copy.hint
                : advanced?.opened === "page"
                  ? (copy.page ?? copy.failed)
                  : advanced?.opened === "app"
                    ? (copy.app ?? copy.failed)
                    : copy.failed}
            </p>
          </div>
        )}
      </DialogPanel>
      <DialogFooter variant="bare">
        <Button variant="outline" disabled={busy} onClick={() => setWay("wifi")}>
          Wi-Fi only
        </Button>
        {current === "port-taken" ? (
          <Button render={<Link to="/settings/access" />} onClick={onDone}>
            Open Sharing &amp; access
          </Button>
        ) : null}
        {copy?.action != null || (current === "not-serving" && waitingOnPerson) ? (
          <Button disabled={busy} onClick={() => void advance()}>
            {busy ? <Spinner size="xs" /> : null}
            {!waitingOnPerson
              ? copy?.action
              : advanced?.opened === "page"
                ? "Open again"
                : "Try again"}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
