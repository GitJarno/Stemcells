import { describe, expect, it } from "vite-plus/test";

import {
  driveDetail,
  isDiskImage,
  isVolumesMount,
  makeDuTally,
  parseDf,
  parseDiskInfo,
} from "./drives.ts";

describe("what df prints", () => {
  it("keeps disks with their whole mount name, and nothing else", () => {
    const volumes = parseDf(`Filesystem     1024-blocks      Used Available Capacity  Mounted on
/dev/disk3s5     482797652 411129436  46036416    90%    /System/Volumes/Data
devfs                  207       207         0   100%    /dev
map auto_home            0         0         0   100%    /System/Volumes/Data/home
/dev/disk10s1    976557744 139278044 837077404    15%    /Volumes/Video Drive 2`);
    expect(volumes.map((volume) => volume.mount)).toEqual([
      "/System/Volumes/Data",
      "/Volumes/Video Drive 2",
    ]);
    expect(volumes[1]).toMatchObject({ total: 976557744 * 1024, free: 837077404 * 1024 });
  });

  it.each([
    ["/Volumes/Backup", true],
    ["/Volumes/Video Drive 2", true],
    ["/Volumes/.timemachine", false],
    ["/Volumes/com.apple.TimeMachine.localsnapshots/Backups", false],
    ["/Volumes/", false],
    ["/System/Volumes/Data", false],
    ["/private/var/run/com.apple.security.cryptexd/mnt/x", false],
  ] as const)("%s is a drive's mount: %s", (mount: string, expected: boolean) => {
    expect(isVolumesMount(mount)).toBe(expected);
  });
});

const plist = (entries: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>${entries}</dict></plist>`;

describe("what diskutil prints", () => {
  it("reads a USB drive, a name with an entity in it, and no solid-state key", () => {
    const info = parseDiskInfo(
      plist(`<key>BusProtocol</key><string>USB</string>
<key>FilesystemType</key><string>hfs</string>
<key>Internal</key><false/>
<key>VolumeName</key><string>Bits &amp; Bobs</string>
<key>VolumeUUID</key><string>00000000-0000-4000-8000-00000000000b</string>`),
    );
    expect(info).toEqual({
      name: "Bits & Bobs",
      uuid: "00000000-0000-4000-8000-00000000000B",
      bus: "USB",
      internal: false,
      solidState: null,
      filesystem: "hfs",
    });
    expect(driveDetail(info)).toBe("USB · Mac OS Extended");
  });

  it("tells a mounted disk image from a drive", () => {
    expect(
      isDiskImage(parseDiskInfo(plist(`<key>BusProtocol</key><string>Disk Image</string>`))),
    ).toBe(true);
    expect(
      isDiskImage(parseDiskInfo(plist(`<key>BusProtocol</key><string>Thunderbolt</string>`))),
    ).toBe(false);
  });

  it("won't remember a drive by anything but a real UUID", () => {
    expect(parseDiskInfo(plist(`<key>VolumeUUID</key><string>../../etc</string>`)).uuid).toBeNull();
  });
});

describe("what du prints", () => {
  it("adds up each folder at the top, its biggest folders inside, and passes over the rest", () => {
    const tally = makeDuTally("/Volumes/Video Drive");
    for (const line of [
      "400\t/Volumes/Video Drive/Footage/2023",
      "600\t/Volumes/Video Drive/Footage/2024",
      "1100\t/Volumes/Video Drive/Footage",
      "8\t/Volumes/Video Drive/.fseventsd",
      "50\t/Volumes/Video Drive/Scans",
      // A folder with a line break in its name, and one claiming to be elsewhere.
      "name part",
      "9999\t/Users/person/secret",
      "1200\t/Volumes/Video Drive",
    ]) {
      tally.add(line);
    }
    const { folders, read } = tally.result();
    expect(read).toBe(true);
    expect(folders.map((folder) => [folder.name, folder.bytes / 1024])).toEqual([
      ["Footage", 1100],
      ["Scans", 50],
    ]);
    expect(folders[0]?.items.map((item) => item.name)).toEqual(["2024", "2023"]);
    expect(tally.counted()).toBe(1150 * 1024);
  });

  it("says it read nothing when macOS kept it out of the drive", () => {
    expect(makeDuTally("/Volumes/Backup").result().read).toBe(false);
  });
});
