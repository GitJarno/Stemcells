/**
 * What a video's playable copy takes from upstream: the asset its route resolved, which the
 * route then serves through `assetFileResponse` (the `http.ts` seam), and the server's state
 * folder for the copies. `playable.contract.test.ts` pins the serving.
 */
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

import type { ResolvedAsset } from "../../assets/AssetAccess.ts";
import * as ServerConfig from "../../config.ts";
import { encodeForPhones } from "../playable/encode.ts";
import { makePlayable } from "../playable/playable.ts";

type FileAsset = Extract<ResolvedAsset, { readonly kind: "file" }>;

const playables = new Map<string, ReturnType<typeof makePlayable>>();

/**
 * The asset to serve under the signed URL `token`: a video's small fast-start copy once one is
 * made, else the asset as it is. Only macOS makes copies (avconvert).
 */
export const playableAsset = Effect.fn("Stemcells.playable.asset")(function* (
  token: string,
  asset: FileAsset,
) {
  if ((yield* HostProcess.Platform) !== "darwin") return asset;
  const config = yield* ServerConfig.ServerConfig;
  const dir = (yield* Path.Path).join(config.stateDir, "stemcells", "playable");
  let playable = playables.get(dir);
  if (playable === undefined) {
    playable = makePlayable({ dir, encode: encodeForPhones });
    playables.set(dir, playable);
  }
  const runFork = Effect.runForkWith(yield* Effect.context<never>());
  const copy = yield* Effect.promise(() =>
    playable.choose(token, asset, (message, detail) => runFork(Effect.logWarning(message, detail))),
  );
  if (copy === null) return asset;
  return {
    kind: "file",
    path: copy,
    mimeType: "video/mp4",
    ...(asset.fileName !== undefined ? { fileName: asset.fileName } : {}),
  } satisfies FileAsset;
});
