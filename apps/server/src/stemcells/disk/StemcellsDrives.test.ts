import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { makeDuTally } from "./drives.ts";
import {
  drivesFile,
  makeDrives,
  processTools,
  STARTUP_DRIVE,
  type DriveTools,
} from "./StemcellsDrives.ts";

const BACKUP = "00000000-0000-4000-8000-00000000000B";
const INSTALLER = "00000000-0000-4000-8000-00000000000C";
const info = (entries: string) => `<plist><dict>${entries}</dict></plist>`;

const tools = (
  ran: Array<string>,
  df = `/dev/disk5s2 1000 100 900 10% /Volumes/Backup
/dev/disk6s2 1000 100 900 10% /Volumes/Backup 1
/dev/disk4s2 100 50 50 50% /Volumes/Installer
/dev/disk9s1 100 50 50 50% /Volumes/No Id`,
): DriveTools => ({
  df: Effect.succeed(df),
  diskInfo: (mount) =>
    Effect.succeed(
      mount.startsWith("/Volumes/Backup")
        ? info(
            `<key>VolumeName</key><string>Backup</string><key>VolumeUUID</key><string>${BACKUP}</string><key>BusProtocol</key><string>USB</string><key>Internal</key><false/>`,
          )
        : mount === "/Volumes/Installer"
          ? info(
              `<key>BusProtocol</key><string>Disk Image</string><key>VolumeUUID</key><string>${INSTALLER}</string>`,
            )
          : mount === "/"
            ? info(`<key>VolumeName</key><string>Macintosh HD</string><key>Internal</key><true/>`)
            : info(`<key>BusProtocol</key><string>USB</string>`),
    ),
  du: (mount) => {
    ran.push(mount);
    return Stream.make(`2048\t${mount}/Footage`, `4096\t${mount}`);
  },
  startup: Effect.succeed({ total: 494e9, free: 47e9 }),
});

const setUp = (ran: Array<string>, du?: DriveTools["du"]) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-drives-" });
    const file = drivesFile(dir);
    const made = yield* makeDrives({ ...tools(ran), ...(du ? { du } : {}) }, file, "This Mac");
    return { fs, file, drives: made.service, walksEnded: made.walksEnded };
  });

it.layer(NodeServices.layer)("a machine's drives", (it) => {
  it.effect("lists the startup drive and real drives, never a disk image", () =>
    Effect.gen(function* () {
      const { drives } = yield* setUp([]);
      const list = yield* drives.list();
      assert.deepStrictEqual(
        list.map((drive) => [drive.name, drive.role]),
        [
          ["Macintosh HD", "startup"],
          ["Backup", "external"],
          ["No Id", "external"],
        ],
      );
      assert.strictEqual(list[1]?.total, 1000 * 1024);
    }).pipe(Effect.scoped),
  );

  it.effect("runs du on a drive only after the person opened it, and forgets when closed", () =>
    Effect.gen(function* () {
      const ran: Array<string> = [];
      const { drives, fs, file, walksEnded } = yield* setUp(ran);

      const closed = yield* drives.look({ id: BACKUP, again: true });
      assert.strictEqual(closed?.scanning, false);
      assert.deepStrictEqual(ran, []);

      assert.strictEqual((yield* drives.setLookInside({ id: BACKUP, on: true }))?.lookInside, true);
      assert.include(yield* fs.readFileString(file), BACKUP);
      yield* drives.look({ id: BACKUP, again: false });
      yield* walksEnded;
      const opened = yield* drives.look({ id: BACKUP, again: false });
      assert.deepStrictEqual(ran, ["/Volumes/Backup"]);
      assert.deepStrictEqual(
        opened?.folders.map((folder) => folder.name),
        ["Footage"],
      );

      yield* drives.setLookInside({ id: BACKUP, on: false });
      const again = yield* drives.look({ id: BACKUP, again: true });
      assert.deepStrictEqual(again?.folders, []);
      assert.strictEqual(ran.length, 1);
    }).pipe(Effect.scoped),
  );

  it.effect("starts over after a walk nobody watched, but not after one too big to finish", () =>
    Effect.gen(function* () {
      const ran: Array<string> = [];
      const { drives, walksEnded } = yield* setUp(ran, (mount) => {
        ran.push(mount);
        return Stream.never;
      });
      yield* drives.setLookInside({ id: BACKUP, on: true });

      yield* drives.look({ id: BACKUP, again: false });
      yield* TestClock.adjust("40 seconds");
      yield* walksEnded;
      yield* drives.look({ id: BACKUP, again: false });
      assert.strictEqual(ran.length, 2);

      for (let looks = 0; looks <= 61; looks += 1) {
        yield* TestClock.adjust("20 seconds");
        yield* drives.look({ id: BACKUP, again: false });
      }
      yield* walksEnded;
      const stopped = yield* drives.look({ id: BACKUP, again: false });
      assert.strictEqual(ran.length, 2);
      assert.isTrue(stopped?.partial);
    }).pipe(Effect.scoped),
  );

  it.effect("keeps a choice it couldn't save from taking effect", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-drives-" });
      yield* fs.writeFileString(`${dir}/stemcells`, "a file where the folder goes");
      const ran: Array<string> = [];
      const { service } = yield* makeDrives(tools(ran), drivesFile(dir), "This Mac");
      const failed = yield* service.setLookInside({ id: BACKUP, on: true }).pipe(Effect.flip);
      assert.strictEqual(failed._tag, "DriveChoiceError");
      yield* service.look({ id: BACKUP, again: true });
      assert.deepStrictEqual(ran, []);
    }).pipe(Effect.scoped),
  );

  it.effect("answers for no drive it didn't list: a path, a disk image, or the startup drive", () =>
    Effect.gen(function* () {
      const ran: Array<string> = [];
      const { drives } = yield* setUp(ran);
      for (const id of ["/Users/person", "../..", "/Volumes/Backup", STARTUP_DRIVE, INSTALLER]) {
        assert.isNull(yield* drives.look({ id, again: true }));
      }
      assert.isNull(yield* drives.setLookInside({ id: "/Users/person", on: true }));
      assert.deepStrictEqual(ran, []);
    }).pipe(Effect.scoped),
  );

  it.effect("won't remember a choice for a drive with no UUID: its device name gets reused", () =>
    Effect.gen(function* () {
      const { drives } = yield* setUp([]);
      assert.isNull(yield* drives.setLookInside({ id: "/dev/disk9s1", on: true }));
    }).pipe(Effect.scoped),
  );
});

it.live("reads a real du's lines and ends it when the reader stops", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-du " });
    yield* fs.makeDirectory(`${root}/Footage/2024`, { recursive: true });
    yield* fs.writeFile(`${root}/Footage/2024/clip.bin`, new Uint8Array(64 * 1024));
    const tools = yield* processTools.pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(HostProcess.Platform, "darwin"),
          Layer.succeed(HostProcess.HomeDirectory, root),
        ),
      ),
    );
    const tally = makeDuTally(root);
    yield* tools.du(root).pipe(Stream.runForEach((line) => Effect.sync(() => tally.add(line))));
    const { folders, read } = tally.result();
    assert.isTrue(read);
    assert.strictEqual(folders[0]?.name, "Footage");
    assert.strictEqual(folders[0]?.items[0]?.name, "2024");
    assert.isAtLeast(folders[0]?.bytes ?? 0, 64 * 1024);

    const first = yield* tools.du(root).pipe(Stream.take(1), Stream.runCollect);
    assert.strictEqual(first.length, 1);
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
