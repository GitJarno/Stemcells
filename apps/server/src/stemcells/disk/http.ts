import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import * as UpstreamDisk from "../upstream/disk.ts";
import * as UpstreamDiskWarn from "../upstream/diskWarn.ts";
import { diskChoices, HiddenAt, writeHiddenAt } from "./notice.ts";
import {
  DISK_KIND_TITLES,
  FINDING_NOTES,
  FINDING_TITLES,
  findingCount,
  findingRisk,
  isMeasuredKind,
} from "./rules.ts";
import * as StemcellsDisk from "./StemcellsDisk.ts";
import * as StemcellsDrives from "./StemcellsDrives.ts";
import type { DiskItem, DiskVolume } from "./walk.ts";
import { WarnBelow, writeWarnBelow } from "./warn.ts";

// GET /api/stemcells/disk: the startup drive now and its last measurement (`?measure=again`); .../volume:
// free space alone, never a walk; POST .../warn and .../notice: the person's choices about it.
// GET .../drives: every drive here; GET .../drive?id=: one besides the startup drive; POST
// .../drive/look-inside `{ id, on }` opens or closes one. A client names a drive by its id, never a path.

const DISK_PATH = "/api/stemcells/disk";
const NO_STORE = { "cache-control": "private, no-store" };

type Choices = Effect.Success<ReturnType<typeof diskChoices>>;
const wireChoices = ({ warnBelow, hiddenAt }: Choices) => ({
  ...(warnBelow === null ? {} : { warnBelow }),
  ...(hiddenAt === null ? {} : { hiddenAt }),
});

/** "Xcode" for `/Applications/Xcode.app`: a folder's own name, an app without its extension. */
const itemName = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.endsWith(".app") ? name.slice(0, -4) : name;
};
const wireItem = (item: DiskItem) => ({ ...item, name: itemName(item.path) });
const wireVolume = (volume: DiskVolume, choices: Choices) => ({
  ...volume,
  used: Math.max(0, volume.total - volume.free),
  ...wireChoices(choices),
});

function toWire(look: StemcellsDisk.DiskLook, choices: Choices) {
  const { volume, map } = look;
  return {
    volume: wireVolume(volume, choices),
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

type ChoicesFor = (free: number | undefined) => Effect.Effect<Choices>;

const lookRoute = Effect.fn("DiskHttp.look")(function* (choices: ChoicesFor) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const again = Option.exists(
    HttpServerRequest.toURL(request),
    (url) => url.searchParams.get("measure") === "again",
  );
  const disk = yield* StemcellsDisk.StemcellsDisk;
  return yield* disk.look({ again }).pipe(
    Effect.flatMap((look) =>
      Effect.map(choices(look.volume.free), (chosen) =>
        HttpServerResponse.jsonUnsafe(toWire(look, chosen), { headers: NO_STORE }),
      ),
    ),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

const volumeRoute = Effect.fn("DiskHttp.volume")(function* (choices: ChoicesFor) {
  const disk = yield* StemcellsDisk.StemcellsDisk;
  return yield* disk.volume().pipe(
    Effect.flatMap((volume) =>
      Effect.map(choices(volume.free), (chosen) =>
        HttpServerResponse.jsonUnsafe(wireVolume(volume, chosen), { headers: NO_STORE }),
      ),
    ),
    Effect.catchTags({ DiskVolumeError: volumeUnreadable }),
  );
});

/** Folders shown by name on a drive that has no kinds; the rest count as "Other". */
const FOLDER_BANDS = 5;
const DRIVE_FOLDER_ITEMS = 8;

/** A look inside a drive, in the same shape as the startup drive's measurement. */
function driveLookToWire(look: StemcellsDrives.DriveLook, choices: Choices) {
  const { drive, folders } = look;
  const shown = folders.slice(0, FOLDER_BANDS);
  const measured = shown.reduce((sum, folder) => sum + folder.bytes, 0);
  const used = Math.max(0, drive.total - drive.free);
  return {
    drive,
    denied: look.denied,
    volume: wireVolume({ total: drive.total, free: drive.free }, choices),
    scanning: look.scanning,
    counted: look.counted,
    map:
      look.measuredAt === null
        ? null
        : {
            measuredAt: look.measuredAt,
            partial: look.partial,
            measured,
            buckets: [
              ...shown.map((folder) => ({
                kind: "folder",
                title: folder.name,
                bytes: folder.bytes,
                items: folder.items.slice(0, DRIVE_FOLDER_ITEMS).map((item) => ({
                  path: item.name,
                  name: item.name,
                  bytes: item.bytes,
                })),
              })),
              { kind: "system", title: "Other", bytes: Math.max(0, used - measured), items: [] },
              { kind: "free", title: "Free", bytes: drive.free, items: [] },
            ],
            findings: [],
            unreadable: [],
          },
  };
}

const drivesRoute = Effect.fn("DiskHttp.drives")(function* (choices: ChoicesFor) {
  const drives = yield* StemcellsDrives.StemcellsDrives;
  const list = yield* drives.list();
  const startup = list.find((drive) => drive.role === "startup");
  const chosen = yield* choices(startup?.free);
  return HttpServerResponse.jsonUnsafe(
    {
      drives: list.map((drive) => ({ ...drive, used: Math.max(0, drive.total - drive.free) })),
      ...wireChoices(chosen),
    },
    { headers: NO_STORE },
  );
});

const driveRoute = Effect.fn("DiskHttp.drive")(function* (choices: ChoicesFor) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const url = HttpServerRequest.toURL(request);
  const id = Option.getOrNull(Option.map(url, (each) => each.searchParams.get("id")));
  const again = Option.exists(url, (each) => each.searchParams.get("measure") === "again");
  const drives = yield* StemcellsDrives.StemcellsDrives;
  const look = id === null ? null : yield* drives.look({ id, again });
  if (look === null) return HttpServerResponse.text("No such drive here.", { status: 404 });
  // The phone's notice is the startup disk's, however much room the drive looked at has.
  const list = yield* drives.list();
  const chosen = yield* choices(list.find((drive) => drive.role === "startup")?.free);
  return HttpServerResponse.jsonUnsafe(driveLookToWire(look, chosen), { headers: NO_STORE });
});

const LookInside = Schema.Struct({
  id: Schema.String.check(Schema.isMaxLength(64)),
  on: Schema.Boolean,
});

const lookInsideRoute = Effect.fn("DiskHttp.lookInside")(function* () {
  const body = yield* HttpServerRequest.schemaBodyJson(LookInside).pipe(Effect.option);
  if (Option.isNone(body)) return HttpServerResponse.text("Expected { id, on }.", { status: 400 });
  const drives = yield* StemcellsDrives.StemcellsDrives;
  return yield* drives.setLookInside(body.value).pipe(
    Effect.map((drive) =>
      drive === null
        ? HttpServerResponse.text("No such drive here.", { status: 404 })
        : HttpServerResponse.jsonUnsafe(drive, { headers: NO_STORE }),
    ),
    Effect.catchCause((cause) =>
      Effect.logWarning("Couldn't keep a choice about a drive", cause).pipe(
        Effect.as(HttpServerResponse.text("Couldn't keep the choice.", { status: 500 })),
      ),
    ),
  );
});

const Warn = Schema.Struct({ warnBelow: WarnBelow });
const Notice = Schema.Struct({ hiddenAt: Schema.NullOr(HiddenAt) });

/** Keeps the choice a body carries and answers it back; 400 for a body that isn't one. */
const choiceRoute = Effect.fn("DiskHttp.choose")(function* <A, E>(
  body: Schema.ConstraintDecoder<A, never>,
  expected: string,
  keep: (choice: A) => Effect.Effect<void, E>,
) {
  const choice = yield* HttpServerRequest.schemaBodyJson(body).pipe(Effect.option);
  if (Option.isNone(choice)) return HttpServerResponse.text(expected, { status: 400 });
  return yield* keep(choice.value).pipe(
    Effect.as(HttpServerResponse.jsonUnsafe(choice.value, { headers: NO_STORE })),
    Effect.catchCause((cause) =>
      Effect.logWarning("Couldn't keep a choice about the disk", cause).pipe(
        Effect.as(HttpServerResponse.text("Couldn't keep the choice.", { status: 500 })),
      ),
    ),
  );
});

/** The person's choices about this machine's disk, for any of their devices to change. */
export const choicesLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const warnFile = yield* UpstreamDiskWarn.diskWarnFile;
    const noticeFile = yield* UpstreamDiskWarn.diskNoticeFile;
    const keepWarn = ({ warnBelow }: typeof Warn.Type) =>
      writeWarnBelow(warnFile, warnBelow).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    const keepNotice = ({ hiddenAt }: typeof Notice.Type) =>
      writeHiddenAt(noticeFile, hiddenAt).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    yield* router.add(
      "POST",
      `${DISK_PATH}/warn`,
      UpstreamDisk.withOperateAccess(
        choiceRoute(Warn, "Expected { warnBelow }: whole bytes, 1 GB to 1 TB.", keepWarn),
      ),
    );
    yield* router.add(
      "POST",
      `${DISK_PATH}/notice`,
      UpstreamDisk.withOperateAccess(
        choiceRoute(Notice, "Expected { hiddenAt }: whole bytes free, or null.", keepNotice),
      ),
    );
  }),
);

/** The drives on this machine: anyone who may read it sees how full; opening one may start work. */
export const drivesLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const drives = yield* StemcellsDrives.StemcellsDrives;
    const fs = yield* FileSystem.FileSystem;
    const stateDir = yield* UpstreamDiskWarn.diskStateDir;
    const choices: ChoicesFor = (free) =>
      diskChoices(stateDir, free).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    const provide = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      route.pipe(Effect.provideService(StemcellsDrives.StemcellsDrives, drives));
    yield* router.add(
      "GET",
      `${DISK_PATH}/drives`,
      UpstreamDisk.withReadAccess(provide(drivesRoute(choices))),
    );
    yield* router.add(
      "GET",
      `${DISK_PATH}/drive`,
      UpstreamDisk.withReadAccess(provide(driveRoute(choices))),
    );
    yield* router.add(
      "POST",
      `${DISK_PATH}/drive/look-inside`,
      UpstreamDisk.withOperateAccess(provide(lookInsideRoute())),
    );
  }),
);

const readLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const disk = yield* StemcellsDisk.StemcellsDisk;
    const fs = yield* FileSystem.FileSystem;
    const stateDir = yield* UpstreamDiskWarn.diskStateDir;
    const choices: ChoicesFor = (free) =>
      diskChoices(stateDir, free).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    const serve = <E, R>(route: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
      UpstreamDisk.withReadAccess(
        route.pipe(Effect.provideService(StemcellsDisk.StemcellsDisk, disk)),
      );
    yield* router.add("GET", DISK_PATH, serve(lookRoute(choices)));
    yield* router.add("GET", `${DISK_PATH}/volume`, serve(volumeRoute(choices)));
  }),
).pipe(Layer.provide(StemcellsDisk.layer));

export const layer = Layer.mergeAll(
  readLayer,
  choicesLayer,
  drivesLayer.pipe(Layer.provide(StemcellsDrives.layer)),
);
