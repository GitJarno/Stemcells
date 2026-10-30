import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as UpstreamDiskWarn from "../upstream/diskWarn.ts";
import {
  DISK_KIND_TITLES,
  FINDING_NOTES,
  FINDING_TITLES,
  findingCount,
  findingRisk,
  isMeasuredKind,
} from "./rules.ts";
import * as StemcellsDisk from "./StemcellsDisk.ts";
import type { DiskItem, DiskVolume } from "./walk.ts";
import { readWarnBelow, WarnBelow, writeWarnBelow } from "./warn.ts";

// GET /api/stemcells/disk: the disk now and the last measurement (`?measure=again` measures
// anew). GET .../volume: free space alone, one statfs, never a walk. Both carry `warnBelow`
// once the person chose it; POST .../warn `{ warnBelow }` chooses how little free space warns.

const DISK_PATH = "/api/stemcells/disk";
const NO_STORE = { "cache-control": "private, no-store" };

/** "Xcode" for `/Applications/Xcode.app`: a folder's own name, an app without its extension. */
const itemName = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.endsWith(".app") ? name.slice(0, -4) : name;
};
const wireItem = (item: DiskItem) => ({ ...item, name: itemName(item.path) });
const wireVolume = (volume: DiskVolume, warnBelow: number | null) => ({
  ...volume,
  used: Math.max(0, volume.total - volume.free),
  ...(warnBelow === null ? {} : { warnBelow }),
});

function toWire(look: StemcellsDisk.DiskLook, warnBelow: number | null) {
  const { volume, map } = look;
  return {
    volume: wireVolume(volume, warnBelow),
    scanning: look.scanning,
    counted: look.counted,
    map:
      map === null
        ? null
        : {
            measuredAt: map.measuredAt,
            partial: map.partial,
            measured: map.buckets
              .filter((bucket) => isMeasuredKind(bucket.kind))
              .reduce((sum, bucket) => sum + bucket.bytes, 0),
            buckets: map.buckets.map((bucket) => ({
              kind: bucket.kind,
              title: DISK_KIND_TITLES[bucket.kind],
              bytes: bucket.bytes,
              items: bucket.items.map(wireItem),
            })),
            findings: map.findings.map((finding) => ({
              kind: finding.kind,
              title: FINDING_TITLES[finding.kind],
              note: FINDING_NOTES[finding.kind],
              risk: findingRisk(finding.kind),
              bytes: finding.bytes,
              countLabel: findingCount(finding.kind, finding.count),
              paths: finding.paths.map(wireItem),
            })),
            unreadable: map.unreadable,
          },
  };
}

const volumeUnreadable = () =>
  Effect.succeed(HttpServerResponse.text("Could not read the size of the disk.", { status: 503 }));

const lookRoute = Effect.fn("DiskHttp.look")(function* (warnBelow: Effect.Effect<number | null>) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const again = Option.exists(
    HttpServerRequest.toURL(request),
    (url) => url.searchParams.get("measure") === "again",
  );
  const disk = yield* StemcellsDisk.StemcellsDisk;
  const chosen = yield* warnBelow;
  return yield* disk.look({ again }).pipe(
    Effect.map((look) =>
      HttpServerResponse.jsonUnsafe(toWire(look, chosen), { headers: NO_STORE }),
    ),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

const volumeRoute = Effect.fn("DiskHttp.volume")(function* (
  warnBelow: Effect.Effect<number | null>,
) {
  const disk = yield* StemcellsDisk.StemcellsDisk;
  const chosen = yield* warnBelow;
  return yield* disk.volume().pipe(
    Effect.map((volume) =>
      HttpServerResponse.jsonUnsafe(wireVolume(volume, chosen), { headers: NO_STORE }),
    ),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

const Warn = Schema.Struct({ warnBelow: WarnBelow });

const warnRoute = Effect.fn("DiskHttp.warn")(function* <E>(
  keep: (warnBelow: number) => Effect.Effect<void, E>,
) {
  const body = yield* HttpServerRequest.schemaBodyJson(Warn).pipe(Effect.option);
  if (Option.isNone(body)) {
    return HttpServerResponse.text("Expected { warnBelow }: whole bytes, 1 GB to 1 TB.", {
      status: 400,
    });
  }
  return yield* keep(body.value.warnBelow).pipe(
    Effect.as(HttpServerResponse.jsonUnsafe(body.value, { headers: NO_STORE })),
    Effect.catchCause((cause) =>
      Effect.logWarning("Couldn't keep the disk's warning", cause).pipe(
        Effect.as(HttpServerResponse.text("Couldn't keep the choice.", { status: 500 })),
      ),
    ),
  );
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const disk = yield* StemcellsDisk.StemcellsDisk;
    const fs = yield* FileSystem.FileSystem;
    const file = yield* UpstreamDiskWarn.diskWarnFile;
    const warnBelow = readWarnBelow(file).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    const keep = (choice: number) =>
      writeWarnBelow(file, choice).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    const serve = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      UpstreamDisk.withReadAccess(
        route.pipe(Effect.provideService(StemcellsDisk.StemcellsDisk, disk)),
      );
    yield* router.add("GET", DISK_PATH, serve(lookRoute(warnBelow)));
    yield* router.add("GET", `${DISK_PATH}/volume`, serve(volumeRoute(warnBelow)));
    yield* router.add("POST", `${DISK_PATH}/warn`, UpstreamDisk.withOperateAccess(warnRoute(keep)));
  }),
).pipe(Layer.provide(StemcellsDisk.layer));
