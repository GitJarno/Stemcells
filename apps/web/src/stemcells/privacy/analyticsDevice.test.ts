import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { afterEach, vi } from "vite-plus/test";

import { noAnalyticsDevice, UPSTREAM_ANALYTICS_DEVICE_ID_KEY } from "./analyticsDevice";

// The id upstream's client kept reached T3's analytics through any T3 server
// it connected to. Stemcells answers that there is none and removes one an
// earlier build left.

afterEach(() => {
  vi.unstubAllGlobals();
});

it.effect(
  "the analytics device id is never made, and one left by an earlier build is removed",
  () =>
    Effect.gen(function* () {
      const stored = new Map([[UPSTREAM_ANALYTICS_DEVICE_ID_KEY, "an-id-from-an-earlier-build"]]);
      vi.stubGlobal("window", {
        localStorage: {
          getItem: (key: string) => stored.get(key) ?? null,
          setItem: (key: string, value: string) => stored.set(key, value),
          removeItem: (key: string) => stored.delete(key),
        },
      });

      assert.isTrue(Option.isNone(yield* noAnalyticsDevice.id));
      assert.isTrue(Option.isNone(yield* noAnalyticsDevice.id));
      assert.deepEqual([...stored.keys()], []);
    }),
);

it.effect("the analytics device id is none when storage is blocked", () =>
  Effect.gen(function* () {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    assert.isTrue(Option.isNone(yield* noAnalyticsDevice.id));
  }),
);
