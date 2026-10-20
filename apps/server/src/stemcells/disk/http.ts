import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import {
  DISK_KIND_TITLES,
  FINDING_NOTES,
  FINDING_TITLES,
  findingCount,
  findingGrade,
  isMeasuredKind,
} from "./rules.ts";
import * as StemcellsDisk from "./StemcellsDisk.ts";
import type { DiskItem, DiskVolume } from "./walk.ts";

// GET /api/stemcells/disk: the disk now and the last measurement, polled
// while Settings › Disk is open (`?measure=again` measures anew).
// GET /api/stemcells/disk/volume: free space alone, one statfs, for the
// sidebar's foot; it never starts a walk.
// GET /api/stemcells/disk/cleanup-draft: the cleanup Cell's first message.

const DISK_PATH = "/api/stemcells/disk";
const NO_STORE = { "cache-control": "private, no-store" };

/** "Xcode" for `/Applications/Xcode.app`: a folder's own name, an app without its extension. */
const itemName = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.endsWith(".app") ? name.slice(0, -4) : name;
};
const wireItem = (item: DiskItem) => ({ ...item, name: itemName(item.path) });
const wireVolume = (volume: DiskVolume) => ({
  ...volume,
  used: Math.max(0, volume.total - volume.free),
});

function toWire(look: StemcellsDisk.DiskLook) {
  const { volume, map } = look;
  return {
    volume: wireVolume(volume),
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
              grade: findingGrade(finding.kind),
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

const lookRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const again = Option.exists(
    HttpServerRequest.toURL(request),
    (url) => url.searchParams.get("measure") === "again",
  );
  const disk = yield* StemcellsDisk.StemcellsDisk;
  return yield* disk.look({ again }).pipe(
    Effect.map((look) => HttpServerResponse.jsonUnsafe(toWire(look), { headers: NO_STORE })),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

const volumeRoute = Effect.gen(function* () {
  const disk = yield* StemcellsDisk.StemcellsDisk;
  return yield* disk.volume().pipe(
    Effect.map((volume) =>
      HttpServerResponse.jsonUnsafe(wireVolume(volume), { headers: NO_STORE }),
    ),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

const draftRoute = Effect.gen(function* () {
  const disk = yield* StemcellsDisk.StemcellsDisk;
  return yield* disk.cleanupDraft().pipe(
    Effect.map((draft) => HttpServerResponse.jsonUnsafe({ draft }, { headers: NO_STORE })),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const disk = yield* StemcellsDisk.StemcellsDisk;
    const serve = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      UpstreamDisk.withReadAccess(
        route.pipe(Effect.provideService(StemcellsDisk.StemcellsDisk, disk)),
      );
    yield* router.add("GET", DISK_PATH, serve(lookRoute));
    yield* router.add("GET", `${DISK_PATH}/volume`, serve(volumeRoute));
    yield* router.add("GET", `${DISK_PATH}/cleanup-draft`, serve(draftRoute));
  }),
).pipe(Layer.provide(StemcellsDisk.layer));
