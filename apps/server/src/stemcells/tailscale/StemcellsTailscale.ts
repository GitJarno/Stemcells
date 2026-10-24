import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as UpstreamTailscale from "../upstream/tailscale.ts";
import {
  authUrlOf,
  backendStateOf,
  openMacApp,
  runCli,
  servesUs,
  startServe,
  stepOf,
  type ServeOutcome,
  type TailscaleStep,
} from "./cli.ts";

// A phone's way to this Mac over Tailscale (stemcells/tasks/devices.md): the
// server stays on loopback, and Tailscale Serve answers for it on the
// tailnet with HTTPS. Each step the person would otherwise take by hand,
// this takes for them: it starts Tailscale, opens its sign-in, names the
// page that turns HTTPS on for the tailnet, and puts Serve in front of this
// server without a restart. Once on, it stays on: Serve is put back after a
// restart or whenever Tailscale comes back, and taken down when the server
// stops, so the tailnet name never answers for a port nobody holds.

export interface TailscaleLook {
  readonly step: TailscaleStep;
  /** The person turned phones over Tailscale on, and hasn't turned them off. */
  readonly on: boolean;
}

export interface TailscaleAdvance extends TailscaleLook {
  /** A page for the person: Tailscale's sign-in, its HTTPS switch, or its download. */
  readonly open: string | null;
  /** The Tailscale app was brought forward: the step waits in its window. */
  readonly openedApp: boolean;
}

export class StemcellsTailscale extends Context.Service<
  StemcellsTailscale,
  {
    readonly look: () => Effect.Effect<TailscaleLook>;
    /** Takes the next step for the person, as far as it can go without them. */
    readonly advance: () => Effect.Effect<TailscaleAdvance>;
    /** Phones stop reaching this computer over Tailscale: Serve comes down and stays down. */
    readonly turnOff: () => Effect.Effect<TailscaleLook>;
  }
>()("t3/stemcells/tailscale/StemcellsTailscale") {}

const DOWNLOAD_URL = "https://tailscale.com/download";
/** How often Serve is checked while on: it goes when Tailscale stops, and comes back here. */
const KEEP_EVERY = Duration.minutes(1);
/** `tailscale serve` either serves or names its page well within this. */
const SERVE_TIMEOUT = Duration.seconds(15);
/** A started Tailscale gets `START_TRIES` looks, `START_POLL` apart, to answer. */
const START_TRIES = 12;
const START_POLL = Duration.millis(500);

const make = Effect.gen(function* () {
  const platform = yield* UpstreamDisk.HostPlatform;
  const ports = yield* UpstreamTailscale.servePorts;
  const markPath = yield* UpstreamTailscale.onMarkPath;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lock = yield* Semaphore.make(1);
  /** Serve was put in front of this server by this run, so it comes down with it. */
  const serving = yield* Ref.make(false);

  const isOn = fs.exists(markPath).pipe(Effect.orElseSucceed(() => false));
  const setOn = (on: boolean) =>
    (on
      ? fs
          .makeDirectory(path.dirname(markPath), { recursive: true })
          .pipe(Effect.andThen(fs.writeFileString(markPath, "")))
      : fs.remove(markPath, { force: true })
    ).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("Tailscale: the on mark wasn't saved", { cause }),
      ),
    );
  const cli = (args: ReadonlyArray<string>, timeoutMs?: number) =>
    Effect.promise(() => runCli(args, platform, timeoutMs));

  const read = Effect.fn("StemcellsTailscale.read")(function* () {
    if (ports === null) return { kind: "missing" } as const satisfies TailscaleStep;
    const status = yield* cli(["status", "--json"]);
    if (status.missing) return { kind: "missing" } as const satisfies TailscaleStep;
    const step = stepOf(status.stdout, null, ports);
    if (step.kind !== "not-serving") return step;
    const serve = yield* cli(["serve", "status", "--json"]);
    const now = stepOf(status.stdout, serve.ok ? serve.stdout : null, ports);
    // Serve in front of this server's port is this run's to take down, however it got there.
    if (now.kind === "ready") yield* Ref.set(serving, true);
    return now;
  });

  const serve = Effect.fn("StemcellsTailscale.serve")(function* () {
    if (ports === null) return { kind: "failed" } as const;
    const outcome = yield* Effect.callback<ServeOutcome>((resume) => {
      const stop = startServe(ports, platform, (done) => resume(Effect.succeed(done)));
      return Effect.sync(stop);
    }).pipe(
      Effect.timeoutOption(SERVE_TIMEOUT),
      Effect.map(Option.getOrElse((): ServeOutcome => ({ kind: "failed" }))),
    );
    if (outcome.kind === "served") yield* Ref.set(serving, true);
    return outcome;
  });

  const look = Effect.fn("StemcellsTailscale.look")(function* () {
    return { step: yield* read(), on: yield* isOn };
  });

  const openApp = Effect.promise(() =>
    platform === "darwin" ? openMacApp() : Promise.resolve(false),
  );

  const advance = Effect.fn("StemcellsTailscale.advance")(function* () {
    const step = yield* read();
    const done = (open: string | null = null, openedApp = false) =>
      Effect.map(look(), (now): TailscaleAdvance => ({ ...now, open, openedApp }));
    switch (step.kind) {
      case "missing":
        return yield* done(DOWNLOAD_URL);
      case "starting":
      case "port-taken":
        return yield* done();
      case "signed-out": {
        // The sign-in Tailscale already started, straight to the browser; else its app.
        const authUrl = authUrlOf((yield* cli(["status", "--json"])).stdout);
        return authUrl === null ? yield* done(null, yield* openApp) : yield* done(authUrl);
      }
      case "stopped": {
        const openedApp = yield* openApp;
        // A just-opened app answers within seconds; then its switch, if that was what was off.
        let state: string | null = null;
        for (let tries = 0; tries < START_TRIES && state === null; tries++) {
          if (tries > 0) yield* Effect.sleep(START_POLL);
          state = backendStateOf((yield* cli(["status", "--json"])).stdout);
        }
        if (state === "Stopped") yield* cli(["up"], 15_000);
        return yield* done(null, openedApp);
      }
      case "https-off":
      case "not-serving": {
        const outcome = yield* serve();
        if (outcome.kind === "consent") return yield* done(outcome.url);
        if (outcome.kind === "served") yield* setOn(true);
        return yield* done();
      }
      case "ready":
        yield* setOn(true);
        return yield* done();
    }
  });

  /** Serve off the tailnet port, only while it still points here: never someone else's. */
  const takeDown = Effect.gen(function* () {
    yield* Ref.set(serving, false);
    if (ports === null) return;
    const status = yield* cli(["status", "--json"]);
    const serve = yield* cli(["serve", "status", "--json"]);
    if (!serve.ok || !servesUs(status.stdout, serve.stdout, ports)) return;
    yield* cli(["serve", `--https=${ports.servePort}`, "off"]);
  });

  const turnOff = Effect.fn("StemcellsTailscale.turnOff")(function* () {
    yield* setOn(false);
    yield* takeDown;
    return yield* look();
  });

  // Before the fork below: finalizers run in reverse, so the keep loop is
  // stopped before Serve comes down, and can't put it back after.
  yield* Effect.addFinalizer(() =>
    Ref.get(serving).pipe(Effect.flatMap((ours) => (ours ? takeDown : Effect.void))),
  );
  // While on: Serve back in front after a restart, or once Tailscale returns.
  // Never the consent page: nobody is looking.
  yield* Effect.gen(function* () {
    if (!(yield* isOn)) return;
    const step = yield* read();
    if (step.kind === "not-serving") yield* serve();
  }).pipe(lock.withPermits(1), Effect.repeat(Schedule.spaced(KEEP_EVERY)), Effect.forkScoped);

  return StemcellsTailscale.of({
    look: () => lock.withPermits(1)(look()),
    advance: () => lock.withPermits(1)(advance()),
    turnOff: () => lock.withPermits(1)(turnOff()),
  });
});

export const layer = Layer.effect(StemcellsTailscale, make);
