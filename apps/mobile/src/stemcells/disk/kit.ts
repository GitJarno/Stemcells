// How full a disk is and how it's drawn, as the Mac reads and draws it: the web's own plain
// TypeScript, imported here and nowhere else, so a drive reads and lands the same on both.

export {
  diskFailure,
  diskPressure,
  freeFigure,
  FULL_BELOW,
  noticeShown,
  SOON_BELOW,
  WARN_CHOICES,
  type DiskFailure,
  type DiskPressure,
} from "../../../../web/src/stemcells/disk/pressure.ts";
export {
  fieldBands,
  fieldLayout,
  hollowCells,
  roundUnit,
  SHELF_MOST_CELLS,
  type FieldBand,
  type FieldFinding,
  type FieldLayout,
} from "../../../../web/src/stemcells/disk/field.ts";
export {
  bandColor,
  DARK_FIELD,
  LIGHT_FIELD,
  rgbCss,
  type FieldColors,
  type Rgb,
} from "../../../../web/src/stemcells/disk/fieldColors.ts";
export {
  cellShape,
  FieldMotion,
  type FieldFocus,
} from "../../../../web/src/stemcells/disk/fieldMotion.ts";
export {
  DISK_PATH,
  STARTUP_DRIVE,
  type Drive,
  type DriveReading,
  type MachineDrives,
} from "../../../../web/src/stemcells/disk/wire.ts";
