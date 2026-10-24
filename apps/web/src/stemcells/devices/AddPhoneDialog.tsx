import { CheckIcon } from "lucide-react";
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
  pairingUrlFor,
  QRCodeSvg,
  reachablePageOrigin,
  refreshRoutes,
  revokePairingLink,
  turnOnNetworkAccess,
  turnOnTailscale,
  useCopyToClipboard,
  useThisMachine,
} from "../upstream/devices";
import { Button, Spinner, toastManager, useRelativeTimeTick } from "../upstream/disk";
import { deviceName, pairedBy } from "./devices";
import { phoneRoute } from "./phoneRoute";

// Settings › Devices › Add › Phone or tablet (stemcells/tasks/devices.md):
// this computer's best address for a phone, a one-time link to it as a QR
// code, and "Paired" once the phone has used it. Without an address, the
// switch that adds one.

const DEFAULT_TAILSCALE_PORT = 443;

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

function AddPhone({ onDone }: { readonly onDone: () => void }) {
  const here = useThisMachine();
  // A desktop app that may not switch this computer's routes reads none of them.
  const route = phoneRoute(
    here.canSwitch
      ? { desktop: true, exposure: here.exposure, endpoints: here.endpoints }
      : { desktop: false, pageOrigin: here.desktop ? null : reachablePageOrigin() },
  );
  const [link, setLink] = useState<Link | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const minting = useRef(false);
  const mounted = useRef(true);
  const unused = useRef<string | null>(null);
  const nowMs = useRelativeTimeTick(1_000);
  const { copyToClipboard } = useCopyToClipboard({
    onCopy: () =>
      toastManager.add({
        type: "success",
        title: "Link copied",
        description: "Paste it on the other device. It works once, for five minutes.",
      }),
  });

  const ready = route.kind === "ready";
  const devices = here.devices;
  const paired =
    link !== null && devices !== null && here.openLinkIds !== null
      ? pairedBy({ linkId: link.id, seen: link.seen, devices, openLinkIds: here.openLinkIds })
      : null;
  const expired = link !== null && Date.parse(link.expiresAt) <= nowMs;

  // Fresh routes on open: the desktop app checks Tailscale again.
  useEffect(() => {
    refreshRoutes();
  }, []);

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
  useEffect(() => {
    unused.current = link !== null && paired === null && !expired ? link.id : null;
  }, [link, paired, expired]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (unused.current !== null) void revokePairingLink(unused.current).catch(() => undefined);
    };
  }, []);

  const flip = async (turnOn: () => Promise<void>) => {
    setSwitching(true);
    try {
      await turnOn();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Couldn't turn it on",
        description:
          error instanceof Error ? error.message : "Try again from Settings › Connections.",
      });
    }
    setSwitching(false);
  };
  const port = here.exposure?.tailscaleServePort ?? DEFAULT_TAILSCALE_PORT;
  const useTailscale = (
    <Button disabled={switching} onClick={() => void flip(() => turnOnTailscale(port))}>
      {switching ? <Spinner size="xs" /> : null}
      Turn on Tailscale
    </Button>
  );
  const useThisNetwork = (
    <Button variant="outline" disabled={switching} onClick={() => void flip(turnOnNetworkAccess)}>
      This network only
    </Button>
  );
  const restartNote = (
    <p className="text-xs text-muted-foreground">
      Stemcells restarts once to turn it on, and any Cell at work stops. Come back here after.
    </p>
  );

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

  if (route.kind === "ready") {
    const url = link === null ? null : pairingUrlFor(route.baseUrl, link.credential);
    const offerTailscale = !route.anywhere && route.tailscaleOff && here.canSwitch;
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
                {new URL(route.baseUrl).host} · {formatExpiresInLabel(link.expiresAt, nowMs)}
              </p>
            ) : null}
          </div>
          {route.tailnet ? (
            <p className="text-xs text-muted-foreground">
              Your phone needs Tailscale too, signed in to the same account.
            </p>
          ) : null}
          {!route.anywhere ? (
            <p className="text-xs text-muted-foreground">
              This works on this network only. Tailscale reaches this computer from anywhere.
            </p>
          ) : null}
          {offerTailscale ? restartNote : null}
        </DialogPanel>
        <DialogFooter variant="bare">
          {offerTailscale ? useTailscale : null}
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
          <Button variant={route.anywhere ? "default" : "outline"} onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (route.kind === "loading")
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add a phone</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </DialogPanel>
      </>
    );

  if (route.kind === "unreachable" || !here.canSwitch)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add a phone</DialogTitle>
          <DialogDescription>
            Open Settings › Devices in the Stemcells app on this computer, which can turn on
            Tailscale for your phone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter variant="bare">
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );

  if (route.kind === "tailscale-silent")
    return (
      <>
        <DialogHeader>
          <DialogTitle>Tailscale isn&apos;t answering</DialogTitle>
          <DialogDescription>
            Start Tailscale on this computer and sign in, then quit and reopen Stemcells.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <p className="text-xs text-muted-foreground">
            On a new tailnet, also turn on HTTPS in Tailscale&apos;s admin console, under DNS ›
            HTTPS Certificates.
          </p>
        </DialogPanel>
        <DialogFooter variant="bare">
          {route.networkOff ? useThisNetwork : null}
          <Button onClick={() => refreshRoutes()}>Check again</Button>
        </DialogFooter>
      </>
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a phone</DialogTitle>
        <DialogDescription>
          Your phone reaches this computer through Tailscale, at home or away. Turn it on here, and
          on your phone with the same account.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>{restartNote}</DialogPanel>
      <DialogFooter variant="bare">
        {route.networkOff ? useThisNetwork : null}
        {useTailscale}
      </DialogFooter>
    </>
  );
}
