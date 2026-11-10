import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";

import * as UpstreamDiskWarn from "../upstream/diskWarn.ts";
import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  configLayerTest,
  scopedAuth as auth,
} from "../upstream/server.fixture.ts";
import { choicesLayer, drivesLayer } from "./http.ts";
import * as StemcellsDrives from "./StemcellsDrives.ts";
import { readHiddenAt, writeHiddenAt } from "./notice.ts";

const hide = (body: unknown, scopes: string | null = AuthOrchestrationOperateScope) =>
  new Request("http://127.0.0.1/api/stemcells/disk/notice", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(scopes === null ? {} : { "x-test-scopes": scopes }),
    },
    body: JSON.stringify(body),
  });

it.layer(NodeServices.layer)("the disk notice's route", (it) => {
  it.effect("hides the notice for a caller who may start work, and shows it again", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-disk-http-" });
      const config = configLayerTest(process.cwd(), baseDir).pipe(
        Layer.provide(NodeServices.layer),
      );
      const file = yield* UpstreamDiskWarn.diskNoticeFile.pipe(Effect.provide(config));
      const web = HttpRouter.toWebHandler(
        choicesLayer.pipe(
          Layer.provideMerge(auth),
          Layer.provideMerge(config),
          Layer.provideMerge(
            HttpPlatform.layer.pipe(
              Layer.provideMerge(NodeServices.layer),
              Layer.provideMerge(Etag.layerWeak),
            ),
          ),
          Layer.provide(NodeServices.layer),
        ),
        { disableLogger: true },
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => web.dispose()));
      const send = (request: Request) => Effect.promise(() => web.handler(request));
      const status = (request: Request) => Effect.map(send(request), (answer) => answer.status);

      assert.strictEqual(yield* status(hide({ hiddenAt: 8e9 }, null)), 401);
      assert.strictEqual(yield* status(hide({ hiddenAt: 8e9 }, AuthOrchestrationReadScope)), 403);
      assert.strictEqual(yield* status(hide({ hiddenAt: -1 })), 400);
      assert.isNull(yield* readHiddenAt(file));

      const answer = yield* send(hide({ hiddenAt: 8e9 }));
      assert.deepStrictEqual(yield* Effect.promise(() => answer.json()), { hiddenAt: 8e9 });
      assert.strictEqual(yield* readHiddenAt(file), 8e9);
      assert.strictEqual(yield* status(hide({ hiddenAt: null })), 200);
      assert.isNull(yield* readHiddenAt(file));
    }).pipe(Effect.scoped),
  );

  it.effect("names a drive by its id: reading needs read access, opening one operate access", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-drives-http-" });
      const config = configLayerTest(process.cwd(), baseDir).pipe(
        Layer.provide(NodeServices.layer),
      );
      const asked: Array<string> = [];
      const drive = {
        id: "00000000-0000-4000-8000-00000000000B",
        name: "Backup",
        role: "external",
        total: 1e12,
        free: 9e11,
        detail: null,
        lookInside: false,
        canLookInside: true,
      } as const;
      const drives = Layer.succeed(StemcellsDrives.StemcellsDrives, {
        list: () =>
          Effect.succeed([
            { ...drive, id: "startup", role: "startup", free: 8e9, canLookInside: false },
            drive,
          ]),
        look: ({ id }) => {
          asked.push(id);
          return Effect.succeed(
            id === drive.id
              ? {
                  drive,
                  scanning: false,
                  counted: 0,
                  measuredAt: null,
                  partial: false,
                  denied: false,
                  folders: [],
                }
              : null,
          );
        },
        setLookInside: ({ id, on }) =>
          Effect.succeed(id === drive.id ? { ...drive, lookInside: on } : null),
      });
      const web = HttpRouter.toWebHandler(
        drivesLayer.pipe(
          Layer.provideMerge(drives),
          Layer.provideMerge(auth),
          Layer.provideMerge(config),
          Layer.provideMerge(
            HttpPlatform.layer.pipe(
              Layer.provideMerge(NodeServices.layer),
              Layer.provideMerge(Etag.layerWeak),
            ),
          ),
          Layer.provide(NodeServices.layer),
        ),
        { disableLogger: true },
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => web.dispose()));
      const status = (path: string, scopes: string | null, body?: unknown) =>
        Effect.promise(() =>
          web.handler(
            new Request(`http://127.0.0.1/api/stemcells/disk/${path}`, {
              method: body === undefined ? "GET" : "POST",
              headers: {
                "content-type": "application/json",
                ...(scopes === null ? {} : { "x-test-scopes": scopes }),
              },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
          ),
        ).pipe(Effect.map((answer) => answer.status));

      const read = AuthOrchestrationReadScope;
      assert.strictEqual(yield* status("drives", null), 401);
      assert.strictEqual(yield* status("drives", read), 200);
      assert.strictEqual(yield* status(`drive?id=${drive.id}`, read), 200);
      assert.strictEqual(yield* status("drive?id=%2FUsers%2Fperson", read), 404);
      assert.strictEqual(yield* status("drive", read), 404);
      assert.deepStrictEqual(asked, [drive.id, "/Users/person"]);

      // Reading a roomy drive says nothing about the startup disk the phone's notice is hidden for.
      const noticeFile = yield* UpstreamDiskWarn.diskNoticeFile.pipe(Effect.provide(config));
      yield* writeHiddenAt(noticeFile, 8e9);
      assert.strictEqual(yield* status(`drive?id=${drive.id}`, read), 200);
      assert.strictEqual(yield* readHiddenAt(noticeFile), 8e9);
      yield* writeHiddenAt(noticeFile, null);

      const open = { id: drive.id, on: true };
      assert.strictEqual(yield* status("drive/look-inside", null, open), 401);
      assert.strictEqual(yield* status("drive/look-inside", read, open), 403);
      const operate = AuthOrchestrationOperateScope;
      assert.strictEqual(yield* status("drive/look-inside", operate, open), 200);
      assert.strictEqual(
        yield* status("drive/look-inside", operate, { id: "/tmp", on: true }),
        404,
      );
      assert.strictEqual(yield* status("drive/look-inside", operate, { id: 7 }), 400);
    }).pipe(Effect.scoped),
  );
});
