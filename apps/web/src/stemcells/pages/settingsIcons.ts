import type { ComponentType } from "react";

import { AskiSettingsIcon } from "../aski/AskiSettingsIcon";
import { DevicesIcon } from "../devices/DevicesIcon";
import { DiskSettingsIcon } from "../disk/DiskSettingsIcon";
import { LineageSettingsIcon } from "../lineage/LineageSettingsIcon";
import type { StemcellsSettingsPath } from "./settingsPages";

/** Each of our settings pages' icon in upstream's settings list (`settingsPages.ts`). */
export const STEMCELLS_SETTINGS_ICONS: Readonly<
  Record<StemcellsSettingsPath, ComponentType<{ className?: string }>>
> = {
  "/settings/disk": DiskSettingsIcon,
  "/settings/aski": AskiSettingsIcon,
  "/settings/devices": DevicesIcon,
  "/settings/lineage": LineageSettingsIcon,
};
