/**
 * What phone pushes take from upstream (stemcells/tasks/phone-push.md): the
 * server's secret store for the person's APNs key, its environment id for
 * the link a tap opens, the app's own data folder for the phones, and the
 * host's platform for whether anybody is at this Mac.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import { readPresence } from "../presence/presence.ts";
import { sendAlert, type ApnsKey } from "../push/apns.ts";
import type { Device, PushSource } from "../push/Push.ts";
import * as UpstreamDisk from "./disk.ts";

/** The secret the key is kept under, beside the server's own. */
const KEY_SECRET = "stemcells-apns-key";

const KeyJson = Schema.fromJsonString(
  Schema.Struct({ keyId: Schema.String, teamId: Schema.String, p8: Schema.String }),
);
const decodeKey = Schema.decodeEffect(KeyJson);
const encodeKey = Schema.encodeEffect(KeyJson);
const DevicesJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      token: Schema.String,
      environment: Schema.Literals(["development", "production"]),
      topic: Schema.String,
      label: Schema.String,
      addedAt: Schema.Number,
    }),
  ),
);
const decodeDevices = Schema.decodeUnknownEffect(DevicesJson);
const encodeDevices = Schema.encodeEffect(DevicesJson);

export const makePushSource = Effect.gen(function* () {
  const secrets = yield* ServerSecretStore.ServerSecretStore;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const platform = yield* UpstreamDisk.HostPlatform;
  const environmentId: string = yield* environment.getEnvironmentId;
  const folder = path.join(config.stateDir, "stemcells");
  const file = path.join(folder, "push-devices.json");

  const readKey = secrets.get(KEY_SECRET).pipe(
    Effect.flatMap((bytes) =>
      Option.isNone(bytes)
        ? Effect.succeed(null)
        : decodeKey(new TextDecoder().decode(bytes.value)),
    ),
    Effect.catchCause((cause) =>
      Effect.logWarning("The APNs key didn't read", cause).pipe(Effect.as(null)),
    ),
  );

  const writeKey = Effect.fn("Push.writeKey")(
    function* (key: ApnsKey | null) {
      if (key === null) yield* secrets.remove(KEY_SECRET);
      else yield* secrets.set(KEY_SECRET, new TextEncoder().encode(yield* encodeKey(key)));
      return true;
    },
    Effect.catchCause((cause) =>
      Effect.logWarning("The APNs key wasn't kept", cause).pipe(Effect.as(false)),
    ),
  );

  const loadDevices = fs.readFileString(file).pipe(
    Effect.flatMap(decodeDevices),
    Effect.orElseSucceed((): ReadonlyArray<Device> => []),
  );

  // One at a time, in the order they came, renamed into place whole.
  const saving = yield* Semaphore.make(1);
  const saveDevices = Effect.fn("Push.saveDevices")(
    function* (devices: ReadonlyArray<Device>) {
      yield* fs.makeDirectory(folder, { recursive: true });
      const temporary = `${file}.tmp`;
      yield* fs.writeFileString(temporary, yield* encodeDevices(devices));
      yield* fs.rename(temporary, file);
    },
    saving.withPermit,
    Effect.catchCause((cause) => Effect.logWarning("The phones for pushes weren't kept", cause)),
  );

  const away = Effect.promise(() => readPresence(platform)).pipe(
    Effect.map((presence) => !presence.present),
  );

  const send: PushSource["send"] = (device, providerToken, alert) =>
    Effect.promise(() =>
      sendAlert({
        environment: device.environment,
        token: device.token,
        topic: device.topic,
        providerToken,
        alert,
      }),
    );

  return {
    environmentId,
    away,
    readKey,
    writeKey,
    loadDevices,
    saveDevices,
    send,
  } satisfies Omit<PushSource, "lists">;
});
