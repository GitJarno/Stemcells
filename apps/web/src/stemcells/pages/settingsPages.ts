/**
 * Stemcells' own settings pages, as upstream's settings lists read them (`stemcells/seams.md`,
 * Settings pages of our own). A new page adds itself here, its icon in `settingsIcons.ts`, and
 * its route file.
 */

export type StemcellsSettingsPath =
  | "/settings/disk"
  | "/settings/aski"
  | "/settings/devices"
  | "/settings/lineage";

/** Each page's name in the settings list, in the list's order. */
export const STEMCELLS_SETTINGS_LABELS: Readonly<Record<StemcellsSettingsPath, string>> = {
  "/settings/disk": "Disk",
  "/settings/aski": "Aski",
  "/settings/devices": "Devices",
  "/settings/lineage": "Lineage",
};

/**
 * No settings scope applies: Disk reads this machine, Aski's switch lives on
 * this device, Devices lists this machine's devices and the computers
 * this device reaches, and Lineage reads every machine's Cells.
 */
export const STEMCELLS_SETTINGS_SCOPES: Readonly<Record<StemcellsSettingsPath, null>> = {
  "/settings/disk": null,
  "/settings/aski": null,
  "/settings/devices": null,
  "/settings/lineage": null,
};

/** The pages whose header names no settings scope. */
export const STEMCELLS_DEVICE_ONLY_PATHS: readonly StemcellsSettingsPath[] = [
  "/settings/disk",
  "/settings/aski",
  "/settings/devices",
  "/settings/lineage",
];
