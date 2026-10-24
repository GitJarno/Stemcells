// @effect-diagnostics nodeBuiltinImport:off - A throwaway P-256 key for the provider token.
import * as NodeCrypto from "node:crypto";

import { assert, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { Need } from "../needs/derive.ts";
import type { NeedsList } from "../needs/Needs.ts";
import type { Alert, ApnsKey, Sent } from "./apns.ts";
import { HOLD_MS } from "./notify.ts";
import { make, type Device } from "./Push.ts";

const KEY: ApnsKey = {
  keyId: "KEY1234567",
  teamId: "TEAM123456",
  p8: NodeCrypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString(),
};

const phone = (token: string) => ({
  token,
  environment: "development" as const,
  topic: "com.example.cells",
  label: `Phone ${token}`,
});

const need = (key: string, sinceMs: number): Need => ({
  key,
  number: 1,
  kind: "question",
  threadId: `thread-${key}`,
  projectId: "project-1",
  parentThreadId: null,
  title: `Cell ${key}`,
  providerInstanceId: "claudeAgent",
  since: DateTime.formatIso(DateTime.makeUnsafe(sinceMs)),
  blocks: true,
  request: null,
  plan: null,
  limit: null,
  failure: null,
  prose: null,
  stuck: null,
});

const listOf = (...needs: ReadonlyArray<Need>): NeedsList => ({ needs, cells: [] });

const world = (key: ApnsKey = KEY) =>
  Effect.gen(function* () {
    const lists = yield* Queue.unbounded<NeedsList>();
    const ticks = yield* Queue.unbounded<void>();
    const sent = yield* Queue.unbounded<{ readonly token: string; readonly alert: Alert }>();
    const saved = yield* Queue.unbounded<ReadonlyArray<Device>>();
    /** Each time a look asks whether anybody is here: a card was due. */
    const asked = yield* Queue.unbounded<void>();
    const state = { away: true, answers: new Map<string, Sent>() };
    const push = yield* make(
      {
        lists: Stream.fromQueue(lists),
        environmentId: "env-1",
        away: Queue.offer(asked, undefined).pipe(Effect.andThen(Effect.sync(() => state.away))),
        readKey: Effect.succeed(key),
        writeKey: () => Effect.succeed(true),
        loadDevices: Effect.succeed([]),
        saveDevices: (devices) => Queue.offer(saved, devices).pipe(Effect.asVoid),
        send: (device, _token, alert) =>
          Queue.offer(sent, { token: device.token, alert }).pipe(
            Effect.as(state.answers.get(device.token) ?? { status: 200, reason: null }),
          ),
      },
      Stream.fromQueue(ticks),
    );
    const register = (token: string) =>
      Effect.andThen(push.register(phone(token)), Queue.take(saved));
    return {
      push,
      lists,
      sent,
      saved,
      asked,
      state,
      register,
      tick: Queue.offer(ticks, undefined),
    };
  });

it.effect("a waiting card reaches the phone once nobody is here, and only once", () =>
  Effect.gen(function* () {
    const w = yield* world();
    yield* w.register("aa11");
    w.state.away = false;
    yield* Queue.offer(w.lists, listOf(need("a", 0)));
    yield* TestClock.adjust(HOLD_MS);
    yield* w.tick;
    yield* Queue.take(w.asked);
    // The person was here: it waits for them to go.
    assert.strictEqual(yield* Queue.size(w.sent), 0);

    w.state.away = true;
    yield* w.tick;
    const first = yield* Queue.take(w.sent);
    assert.strictEqual(first.token, "aa11");
    assert.deepStrictEqual(first.alert.data, {
      environmentId: "env-1",
      threadId: "thread-a",
      deepLink: "/threads/env-1/thread-a",
    });

    // A second card is the next push; the first never buzzes again.
    yield* Queue.offer(w.lists, listOf(need("a", 0), need("b", HOLD_MS)));
    yield* TestClock.adjust(HOLD_MS);
    yield* w.tick;
    assert.strictEqual((yield* Queue.take(w.sent)).alert.threadId, "thread-b");
  }).pipe(Effect.scoped),
);

it.effect("a phone Apple says is gone is forgotten, and the rest still hear", () =>
  Effect.gen(function* () {
    const w = yield* world();
    yield* w.register("aa11");
    yield* w.register("bb22");
    w.state.answers.set("aa11", { status: 410, reason: "Unregistered" });
    yield* TestClock.adjust(HOLD_MS);
    yield* Queue.offer(w.lists, listOf(need("a", 0)));

    const kept = yield* Queue.take(w.saved);
    assert.deepStrictEqual(
      kept.map((device) => device.token),
      ["bb22"],
    );
    const status = yield* w.push.status;
    assert.deepStrictEqual(
      status.devices.map((device) => device.label),
      ["Phone bb22"],
    );
    assert.deepStrictEqual(status.last?.why, "Unregistered");

    const tested = yield* w.push.test;
    assert.deepStrictEqual(
      tested.map((result) => result.label),
      ["Phone bb22"],
    );
    assert.strictEqual((yield* w.push.status).last?.ok, true);
  }).pipe(Effect.scoped),
);

it.effect("a key that doesn't sign keeps the card for when one does", () =>
  Effect.gen(function* () {
    const w = yield* world({ ...KEY, p8: "not a key" });
    yield* w.register("aa11");
    yield* TestClock.adjust(HOLD_MS);
    yield* Queue.offer(w.lists, listOf(need("a", 0)));
    yield* Queue.take(w.asked);
    assert.strictEqual((yield* w.push.status).last?.why, "The APNs key didn't sign");
    assert.strictEqual(yield* Queue.size(w.sent), 0);

    assert.isTrue(yield* w.push.setKey(KEY));
    yield* w.tick;
    assert.strictEqual((yield* Queue.take(w.sent)).alert.threadId, "thread-a");
  }).pipe(Effect.scoped),
);

it.effect("a push Apple never took is tried again on the next look", () =>
  Effect.gen(function* () {
    const w = yield* world();
    yield* w.register("aa11");
    w.state.answers.set("aa11", { status: 0, reason: "offline" });
    yield* TestClock.adjust(HOLD_MS);
    yield* Queue.offer(w.lists, listOf(need("a", 0)));
    yield* Queue.take(w.sent);

    w.state.answers.delete("aa11");
    yield* w.tick;
    assert.strictEqual((yield* Queue.take(w.sent)).alert.threadId, "thread-a");
    assert.strictEqual((yield* w.push.status).last?.ok, true);
  }).pipe(Effect.scoped),
);
