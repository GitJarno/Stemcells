/**
 * A carry on the browser's own drag: what it holds, by reference, under a type of our own. The
 * browser's drag is what crosses panes, tabs (they spring open), windows and other apps, and a
 * chat tells this type from files off the disk. A drop reads it only once the hand lets go; over
 * a chat only its type shows.
 */
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { AssetResource, MAX_ATTACHMENTS } from "../upstream/payloads";
import type { Shown } from "./payload";

export const CARRIED_TYPE = "application/x-stemcells-attachment";

const Item = Schema.Struct({
  name: Schema.String,
  kind: Schema.Literals(["image", "video", "file"]),
  mimeType: Schema.NullOr(Schema.String),
  sizeBytes: Schema.NullOr(Schema.Number),
  asset: Schema.NullOr(Schema.Struct({ environmentId: Schema.String, resource: AssetResource })),
  url: Schema.NullOr(Schema.String),
});

const CarriedSchema = Schema.Struct({
  version: Schema.Literal(1),
  /** Which drag it is, so the window that started it can give the bytes it holds. */
  drag: Schema.String,
  items: Schema.Array(Item).check(Schema.isMaxLength(MAX_ATTACHMENTS)),
});

/** What one drag holds. */
export interface Carried {
  readonly version: 1;
  readonly drag: string;
  readonly items: ReadonlyArray<Shown>;
}

const Wire = Schema.fromJsonString(CarriedSchema);
const decodeWire = Schema.decodeUnknownOption(Wire);

export const encodeCarried: (carried: Carried) => string = Schema.encodeSync(Wire);

/** What a drop holds, or null for anything that isn't a carry this app writes. */
export function decodeCarried(raw: string): Carried | null {
  return Option.getOrNull(decodeWire(raw));
}

/** Whether a drag is a carry, from the types every drag event shows. */
export function isCarry(types: ReadonlyArray<string>): boolean {
  return types.includes(CARRIED_TYPE);
}
