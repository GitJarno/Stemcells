/**
 * Stemcells' own settings pages, as upstream's settings lists read them (`stemcells/seams.md`,
 * Settings pages of our own). A new page adds itself here, its icon in `settingsIcons.ts`, and
 * its route file.
 */

export type StemcellsSettingsPath =
  | "/settings/disk"
  | "/settings/aski"
  | "/settings/your-devices"
  | "/settings/lineage";

/** Each page's name in the settings list. */
export const STEMCELLS_SETTINGS_LABELS: Readonly<Record<StemcellsSettingsPath, string>> = {
  "/settings/disk": "Disk",
  "/settings/aski": "Aski",
  "/settings/your-devices": "Your devices",
  "/settings/lineage": "Lineage",
};

/**
 * No settings scope applies: Disk reads this machine, Aski's switch lives on
 * this device, Your devices lists this machine's devices and the computers
 * this device reaches, and Lineage reads every machine's Cells.
 */
export const STEMCELLS_SETTINGS_SCOPES: Readonly<Record<StemcellsSettingsPath, null>> = {
  "/settings/disk": null,
  "/settings/aski": null,
  "/settings/your-devices": null,
  "/settings/lineage": null,
};

/**
 * Where each page stands in upstream's grouped settings list: after the page named, by
 * concern. Upstream's Devices is the devices agents drive, so the person's own are Your
 * devices, beside Environments. A page whose neighbour upstream drops goes to the list's end.
 */
export const STEMCELLS_SETTINGS_NAV_AFTER: Readonly<Record<StemcellsSettingsPath, string>> = {
  "/settings/aski": "/settings/scheduled-tasks",
  "/settings/lineage": "/settings/aski",
  "/settings/your-devices": "/settings/connections",
  "/settings/disk": "/settings/maintenance",
};

/** The pages whose header names no settings scope. */
export const STEMCELLS_DEVICE_ONLY_PATHS: readonly StemcellsSettingsPath[] = [
  "/settings/disk",
  "/settings/aski",
  "/settings/your-devices",
  "/settings/lineage",
];
