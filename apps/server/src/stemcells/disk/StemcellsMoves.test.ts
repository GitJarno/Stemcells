// @effect-diagnostics nodeBuiltinImport:off - real folders in a temporary home and a stand-in drive.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import { it } from "@effect/vitest";
import { afterEach, expect } from "vite-plus/test";

import { MoveError, makeMoves, type MoveTools } from "./StemcellsMoves.ts";
import type { Drive } from "./StemcellsDrives.ts";
import type * as StemcellsDrives from "./StemcellsDrives.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});
const fresh = () => {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-moves-"));
  dirs.push(dir);
  return dir;
};

const DEVICES = "Library/Developer/CoreSimulator/Devices";
const drive: Drive = {
  id: "00000000-0000-4000-8000-00000000000D",
  name: "Spare",
  role: "external",
  total: 1e12,
  free: 9e11,
  detail: null,
  lookInside: false,
  canLookInside: true,
};

const tallyOf = (dir: string) => {
  let files = 0;
  let bytes = 0;
  const walk = (path: string) => {
    files += 1;
    const info = NodeFS.lstatSync(path);
    if (info.isDirectory()) for (const name of NodeFS.readdirSync(path)) walk(`${path}/${name}`);
    else bytes += info.size;
  };
  walk(dir);
  return { files, kilobytes: Math.ceil(bytes / 1024) };
};

/** A home with two simulators, a stand-in drive, and tools that act on real folders. */
const setup = (
  more: { booted?: string[]; answers?: boolean; connected?: boolean; owners?: boolean } = {},
) => {
  const home = fresh();
  const mount = fresh();
  const devices = `${home}/${DEVICES}`;
  for (const udid of ["AAA", "BBB"]) {
    NodeFS.mkdirSync(`${devices}/${udid}/data`, { recursive: true });
    NodeFS.writeFileSync(`${devices}/${udid}/device.plist`, udid.repeat(500));
  }
  const state = { booted: more.booted ?? [], answers: more.answers ?? true, restarts: 0 };
  const tools: MoveTools = {
    copy: (from, to) => Effect.sync(() => NodeFS.cpSync(from, to, { recursive: true })),
    tally: (dir) => Effect.sync(() => tallyOf(dir)),
    freeBytes: () => Effect.succeed(1e12),
    remove: (dir) => Effect.sync(() => NodeFS.rmSync(dir, { recursive: true, force: true })),
    bootedSimulators: Effect.sync(() => state.booted),
    // The service lists what it finds where the link points; `answers: false`, never once restarted.
    simulatorIds: () =>
      Effect.sync(() =>
        state.answers || state.restarts === 0 ? NodeFS.readdirSync(devices).sort() : null,
      ),
    restartSimulators: Effect.sync(() => {
      state.restarts += 1;
    }),
    xcodeRunning: Effect.succeed(false),
  };
  const connected = more.connected ?? true;
  const drives = {
    list: () => Effect.succeed(connected ? [drive] : []),
    look: () => Effect.succeed(null),
    setLookInside: () => Effect.succeed(null),
    place: (id: string) =>
      Effect.succeed(
        connected && id === drive.id
          ? { drive, mount, filesystem: "apfs", owners: more.owners ?? true }
          : null,
      ),
    machine: () => Effect.succeed("MACHINE"),
  } satisfies StemcellsDrives.StemcellsDrives["Service"];
  const file = `${home}/state/stemcells/disk-moves.json`;
  const make = makeMoves({ tools, home, file, drives });
  const onDrive = `${mount}/Stemcells/MACHINE/${DEVICES}`;
  return { home, mount, devices, onDrive, state, file, make };
};

it.layer(NodeServices.layer)("moving a folder to another drive", (it) => {
  it.effect(
    "leaves a link to a whole copy on the drive, keeps the record, and deletes the original",
    () =>
      Effect.gen(function* () {
        const lab = setup();
        const status = yield* Effect.gen(function* () {
          const { service, settled } = yield* lab.make;
          yield* service.moveAway({ kind: "simulators", driveId: drive.id });
          yield* settled;
          return yield* service.status();
        });
        expect(NodeFS.lstatSync(lab.devices).isSymbolicLink()).toBe(true);
        expect(NodeFS.readlinkSync(lab.devices)).toBe(lab.onDrive);
        expect(NodeFS.readdirSync(lab.devices).sort()).toEqual(["AAA", "BBB"]);
        expect(NodeFS.existsSync(`${lab.devices}.stemcells-old`)).toBe(false);
        expect(lab.state.restarts).toBe(1);
        expect(status.last).toMatchObject({ kind: "simulators", direction: "away", ok: true });
        expect(status.places.find((place) => place.kind === "simulators")).toMatchObject({
          where: "away",
          drive: { id: drive.id, name: "Spare", connected: true },
        });
        expect(JSON.parse(NodeFS.readFileSync(lab.file, "utf8")).moves).toHaveLength(1);
      }),
  );

  it.effect("won't start while a simulator runs, and touches nothing", () =>
    Effect.gen(function* () {
      const lab = setup({ booted: ["Lab phone"] });
      const error = yield* Effect.gen(function* () {
        const { service } = yield* lab.make;
        return yield* Effect.flip(service.moveAway({ kind: "simulators", driveId: drive.id }));
      });
      expect(error).toBeInstanceOf(MoveError);
      expect(error.reason).toContain("Lab phone");
      expect(NodeFS.lstatSync(lab.devices).isDirectory()).toBe(true);
      expect(NodeFS.existsSync(lab.onDrive)).toBe(false);
    }),
  );

  it.effect(
    "won't move simulators to a drive that ignores ownership, which they can't boot from",
    () =>
      Effect.gen(function* () {
        const lab = setup({ owners: false });
        const error = yield* Effect.gen(function* () {
          const { service } = yield* lab.make;
          return yield* Effect.flip(service.moveAway({ kind: "simulators", driveId: drive.id }));
        });
        expect(error.reason).toContain("Ignore ownership on this volume");
        expect(NodeFS.lstatSync(lab.devices).isDirectory()).toBe(true);
        expect(NodeFS.existsSync(lab.onDrive)).toBe(false);
      }),
  );

  it.effect("undoes a switch the simulators don't open from, before the original goes", () =>
    Effect.gen(function* () {
      const lab = setup({ answers: false });
      const status = yield* Effect.gen(function* () {
        const { service, settled } = yield* lab.make;
        yield* service.moveAway({ kind: "simulators", driveId: drive.id });
        yield* settled;
        return yield* service.status();
      });
      expect(NodeFS.lstatSync(lab.devices).isDirectory()).toBe(true);
      expect(NodeFS.readdirSync(lab.devices).sort()).toEqual(["AAA", "BBB"]);
      expect(NodeFS.existsSync(lab.onDrive)).toBe(false);
      expect(NodeFS.existsSync(lab.file)).toBe(false);
      expect(status.last).toMatchObject({ ok: false, direction: "away" });
      expect(status.last?.reason).toContain("stay on this Mac");
    }),
  );

  it.effect("moves back: the folder is here again, the drive's copy and the record are gone", () =>
    Effect.gen(function* () {
      const lab = setup();
      const status = yield* Effect.gen(function* () {
        const { service, settled } = yield* lab.make;
        yield* service.moveAway({ kind: "simulators", driveId: drive.id });
        yield* settled;
        yield* service.moveBack("simulators");
        yield* settled;
        return yield* service.status();
      });
      expect(NodeFS.lstatSync(lab.devices).isDirectory()).toBe(true);
      expect(NodeFS.readdirSync(lab.devices).sort()).toEqual(["AAA", "BBB"]);
      expect(NodeFS.existsSync(lab.onDrive)).toBe(false);
      expect(JSON.parse(NodeFS.readFileSync(lab.file, "utf8")).moves).toEqual([]);
      expect(status.places.find((place) => place.kind === "simulators")?.where).toBe("here");
    }),
  );

  it.effect("starts fresh only when the drive is gone", () =>
    Effect.gen(function* () {
      const lab = setup();
      yield* Effect.gen(function* () {
        const { service, settled } = yield* lab.make;
        yield* service.moveAway({ kind: "simulators", driveId: drive.id });
        yield* settled;
        const refused = yield* Effect.flip(service.startFresh("simulators"));
        expect(refused.reason).toContain("move it back");
      });
      // The same home and record, with the drive unplugged.
      const status = yield* Effect.gen(function* () {
        const { service } = yield* makeMoves({
          tools: {
            copy: () => Effect.void,
            tally: () => Effect.succeed({ files: 0, kilobytes: 0 }),
            freeBytes: () => Effect.succeed(0),
            remove: () => Effect.void,
            bootedSimulators: Effect.succeed([]),
            simulatorIds: () => Effect.succeed([]),
            restartSimulators: Effect.void,
            xcodeRunning: Effect.succeed(false),
          },
          home: lab.home,
          file: lab.file,
          drives: {
            list: () => Effect.succeed([]),
            look: () => Effect.succeed(null),
            setLookInside: () => Effect.succeed(null),
            place: () => Effect.succeed(null),
            machine: () => Effect.succeed("MACHINE"),
          },
        });
        const before = yield* service.status();
        expect(before.places.find((place) => place.kind === "simulators")).toMatchObject({
          where: "away",
          drive: { connected: false },
        });
        yield* service.startFresh("simulators");
        return yield* service.status();
      });
      expect(NodeFS.lstatSync(lab.devices).isDirectory()).toBe(true);
      expect(NodeFS.readdirSync(lab.devices)).toEqual([]);
      expect(status.places.find((place) => place.kind === "simulators")?.where).toBe("here");
    }),
  );
});
