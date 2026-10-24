import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import type { Need } from "../needs/derive.ts";
import * as Needs from "../needs/Needs.ts";
import * as Upstream from "../upstream/push.ts";
import {
  isGone,
  isTransient,
  providerToken,
  type Alert,
  type ApnsKey,
  type ApsEnvironment,
  type Sent,
} from "./apns.ts";
import { alertWords, due } from "./notify.ts";

/** A phone that asked for pushes: its APNs token, which of Apple's services it's on, and its app's bundle id. */
export interface Device {
  readonly token: string;
  readonly environment: ApsEnvironment;
  readonly topic: string;
  readonly label: string;
  readonly addedAt: number;
}

export interface PushSource {
  readonly lists: Stream.Stream<Needs.NeedsList>;
  /** This server's environment id, for the link a tap opens. */
  readonly environmentId: string;
  /** Whether nobody is at this Mac now (`presence/presence.ts`). */
  readonly away: Effect.Effect<boolean>;
  readonly readKey: Effect.Effect<ApnsKey | null>;
  /** Whether the key was kept: a key only this run knew would be gone after a restart. */
  readonly writeKey: (key: ApnsKey | null) => Effect.Effect<boolean>;
  readonly loadDevices: Effect.Effect<ReadonlyArray<Device>>;
  readonly saveDevices: (devices: ReadonlyArray<Device>) => Effect.Effect<void>;
  readonly send: (device: Device, providerToken: string, alert: Alert) => Effect.Effect<Sent>;
}

/**
 * What Settings shows: whether a key is set, the phones, and how the last
 * push went. Never the key; a phone's token is only an address, and is how
 * Settings removes it.
 */
export interface PushStatus {
  readonly key: { readonly keyId: string; readonly teamId: string } | null;
  readonly devices: ReadonlyArray<{
    readonly token: string;
    readonly label: string;
    readonly environment: ApsEnvironment;
    readonly addedAt: string;
  }>;
  readonly last: { readonly at: string; readonly ok: boolean; readonly why: string | null } | null;
}

/**
 * The person's phone hears from this Mac when a Cell needs them and they
 * aren't here (stemcells/tasks/phone-push.md): straight to Apple with
 * their own key, nobody else's service between.
 */
export class Push extends Context.Service<
  Push,
  {
    readonly status: Effect.Effect<PushStatus>;
    readonly register: (device: Omit<Device, "addedAt">) => Effect.Effect<void>;
    readonly unregister: (token: string) => Effect.Effect<void>;
    /** Whether it was kept. */
    readonly setKey: (key: ApnsKey | null) => Effect.Effect<boolean>;
    /** A push to every phone now, to see that they hear; what each said. */
    readonly test: Effect.Effect<ReadonlyArray<{ readonly label: string; readonly sent: Sent }>>;
  }
>()("t3/stemcells/push/Push") {}

/** How often waiting cards are looked at. */
export const TICK = Duration.seconds(15);
/** A provider token serves this long: under Apple's hour, past its 20-minute floor. */
const TOKEN_FOR_MS = 45 * 60_000;
const DEVICES_MAX = 20;
const RESTART_AFTER = Duration.seconds(5);

const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

export const make = Effect.fn("Push.make")(function* (
  source: PushSource,
  /** What looks at the waiting cards besides a changed list. Tests drive it by hand. */
  ticks: Stream.Stream<unknown> = Stream.tick(TICK),
) {
  let devices = yield* source.loadDevices;
  let key = yield* source.readKey;
  let token: { readonly value: string; readonly at: number } | null = null;
  let last: PushStatus["last"] = null;
  let needs: ReadonlyArray<Need> = [];
  const pushed = new Set<string>();
  const sending = yield* Semaphore.make(1);

  const tokenAt = (now: number): string | null => {
    if (key === null) return null;
    if (token === null || now - token.at >= TOKEN_FOR_MS) {
      token = { value: providerToken(key, now / 1000), at: now };
    }
    return token.value;
  };

  /**
   * Sends to one phone. A token Apple doesn't know on the service the phone
   * named is tried once on the other: a release build signed for
   * development (as a build to one's own phone is) gets a sandbox token,
   * and nothing on the phone can tell.
   */
  const sendOne = Effect.fn("Push.sendOne")(function* (
    device: Device,
    signed: string,
    alert: Alert,
  ) {
    const sent = yield* source.send(device, signed, alert);
    if (sent.reason !== "BadDeviceToken") return { device, sent };
    const moved: Device = {
      ...device,
      environment: device.environment === "production" ? "development" : "production",
    };
    const again = yield* source.send(moved, signed, alert);
    return again.status === 200 ? { device: moved, sent: again } : { device, sent };
  });

  /** Sends one alert to every phone; drops the ones Apple says are gone. */
  const sendAll = Effect.fn("Push.sendAll")(function* (alert: Alert, now: number) {
    const signed = yield* Effect.try({ try: () => tokenAt(now), catch: () => null }).pipe(
      Effect.orElseSucceed(() => null),
    );
    if (signed === null) {
      if (key !== null) last = { at: iso(now), ok: false, why: "The APNs key didn't sign" };
      return [];
    }
    const results = yield* Effect.forEach(devices, (device) => sendOne(device, signed, alert), {
      concurrency: "unbounded",
    });
    // Phones Apple calls gone are dropped, and one found on its other service is kept there.
    const answered = new Map(results.map((result) => [result.device.token, result]));
    const next = devices.flatMap((device) => {
      const result = answered.get(device.token);
      if (result === undefined) return [device];
      return isGone(result.sent) ? [] : [result.device];
    });
    if (next.length !== devices.length || next.some((device, index) => device !== devices[index])) {
      devices = next;
      yield* source.saveDevices(devices);
    }
    const failed = results.find(({ sent }) => sent.status !== 200);
    last = {
      at: iso(now),
      ok: failed === undefined,
      why:
        failed === undefined
          ? null
          : (failed.sent.reason ?? `Apple answered ${failed.sent.status}`),
    };
    return results;
  });

  const alertOf = (need: Need): Alert => ({
    ...alertWords(need),
    threadId: need.threadId,
    data: {
      environmentId: source.environmentId,
      threadId: need.threadId,
      deepLink: `/threads/${encodeURIComponent(source.environmentId)}/${encodeURIComponent(need.threadId)}`,
    },
  });

  const look = Effect.fn("Push.look")(function* () {
    const now = yield* Clock.currentTimeMillis;
    if (key === null || devices.length === 0) return;
    const waiting = due(needs, pushed, now);
    // A card waiting while the person is here stays unpushed: if they go, it buzzes then.
    if (waiting.length === 0 || !(yield* source.away)) return;
    for (const need of waiting) {
      const results = yield* sendAll(alertOf(need), now);
      // Apple out of reach, or a key that doesn't sign: the next look tries again.
      if (!results.every(({ sent }) => isTransient(sent))) pushed.add(need.key);
    }
  });

  const onList = (list: Needs.NeedsList) =>
    Effect.sync(() => {
      needs = list.needs;
      const live = new Set(list.needs.map((need) => need.key));
      for (const key of pushed) if (!live.has(key)) pushed.delete(key);
    });

  yield* Stream.merge(
    Stream.map(source.lists, (list) => ({ list })),
    Stream.map(ticks, () => null),
  ).pipe(
    Stream.runForEach((event) =>
      sending.withPermit(Effect.andThen(event === null ? Effect.void : onList(event.list), look())),
    ),
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) => Effect.logWarning("Phone pushes stopped; they start again from the list", cause),
    ),
    Effect.andThen(Effect.sleep(RESTART_AFTER)),
    Effect.forever,
    Effect.forkScoped,
  );

  return Push.of({
    status: Effect.sync(() => ({
      key: key === null ? null : { keyId: key.keyId, teamId: key.teamId },
      devices: devices.map((device) => ({
        token: device.token,
        label: device.label,
        environment: device.environment,
        addedAt: iso(device.addedAt),
      })),
      last,
    })),
    register: Effect.fn("Push.register")(function* (device) {
      const now = yield* Clock.currentTimeMillis;
      const known = devices.find((each) => each.token === device.token);
      // A phone asks again each time it opens; a token keeps the service Apple took it on.
      const environment = known?.environment ?? device.environment;
      if (known?.topic === device.topic && known.label === device.label) return;
      devices = [
        ...devices.filter((each) => each.token !== device.token),
        { ...device, environment, addedAt: known?.addedAt ?? now },
      ].slice(-DEVICES_MAX);
      yield* source.saveDevices(devices);
    }),
    unregister: Effect.fn("Push.unregister")(function* (gone) {
      if (!devices.some((device) => device.token === gone)) return;
      devices = devices.filter((device) => device.token !== gone);
      yield* source.saveDevices(devices);
    }),
    setKey: Effect.fn("Push.setKey")(function* (next) {
      const kept = yield* source.writeKey(next);
      if (kept) {
        key = next;
        token = null;
      }
      return kept;
    }),
    test: sending.withPermit(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const results = yield* sendAll(
          {
            title: "Stemcells",
            body: "This phone hears when a Cell needs you and you're away from the Mac.",
            threadId: "stemcells-test",
            data: { environmentId: source.environmentId, threadId: "", deepLink: "" },
          },
          now,
        );
        return results.map(({ device, sent }) => ({ label: device.label, sent }));
      }),
    ),
  });
});

export const layer = Layer.effect(
  Push,
  Effect.gen(function* () {
    const needs = yield* Needs.Needs;
    const upstream = yield* Upstream.makePushSource;
    return yield* make({ ...upstream, lists: needs.changes });
  }),
).pipe(Layer.provide(Needs.layer));
