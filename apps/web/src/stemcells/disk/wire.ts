// The disk routes' answers, as a machine's server sends them (`apps/server/src/stemcells/disk/
// http.ts`): plain types, so the web and the phone read one shape.

/** `GET /api/stemcells/disk`, as the server sends it. */
export interface DiskItem {
  readonly path: string;
  readonly name: string;
  readonly bytes: number;
}

export interface DiskReading {
  readonly volume: {
    readonly total: number;
    readonly free: number;
    readonly used: number;
    /** How little free space warns the person, once they chose. */
    readonly warnBelow?: number;
    /** The free space the phone's disk notice was hidden at, while that stands. */
    readonly hiddenAt?: number;
  };
  readonly scanning: boolean;
  readonly counted: number;
  readonly map: {
    readonly measuredAt: number;
    readonly partial: boolean;
    readonly measured: number;
    readonly buckets: ReadonlyArray<{
      readonly kind: string;
      readonly title: string;
      readonly bytes: number;
      readonly items: ReadonlyArray<DiskItem>;
    }>;
    readonly findings: ReadonlyArray<{
      readonly kind: string;
      readonly title: string;
      readonly note: string;
      readonly risk: "low" | "medium";
      readonly bytes: number;
      readonly countLabel: string | null;
      readonly paths: ReadonlyArray<DiskItem>;
    }>;
    readonly unreadable: ReadonlyArray<string>;
  } | null;
}

export const DISK_PATH = "/api/stemcells/disk";

export const STARTUP_DRIVE = "startup";

/** `GET /api/stemcells/disk/drives`, one drive. */
export interface Drive {
  readonly id: string;
  readonly name: string;
  readonly role: "startup" | "internal" | "external";
  readonly total: number;
  readonly free: number;
  readonly detail: string | null;
  readonly lookInside: boolean;
  readonly canLookInside: boolean;
}

/** A drive's reading: the startup drive's measurement, or a look inside another (`/drive`). */
export interface DriveReading extends DiskReading {
  readonly drive?: Drive;
  readonly denied?: boolean;
}

export interface MachineDrives {
  /** "unknown": no answer yet, or a server with no drives route, which leaves the snapshot's disk. */
  readonly status: "unknown" | "known";
  readonly drives: ReadonlyArray<Drive>;
  readonly warnBelow?: number;
}
