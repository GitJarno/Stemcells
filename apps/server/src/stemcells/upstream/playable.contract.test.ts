import * as NodeHttpPlatform from "@effect/platform-node/NodeHttpPlatform";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { HttpServerResponse } from "effect/http";

import { assetFileResponse } from "../../http.ts";

// The asset `playableAsset` hands upstream's route in a video's place: a path and a type, with
// no open file. A player asks for it a range at a time.
it.effect("upstream's asset route streams a copy by its path, a range at a time", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-playable-" });
    const copy = (yield* Path.Path).join(dir, "copy.mp4");
    yield* fs.writeFileString(copy, "0123456789");

    const response = HttpServerResponse.toWeb(
      yield* assetFileResponse({ path: copy, mimeType: "video/mp4" }, "bytes=2-5"),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(yield* Effect.promise(() => response.text())).toBe("2345");
  }).pipe(Effect.provide(Layer.mergeAll(NodeHttpPlatform.layer, NodeServices.layer))),
);
