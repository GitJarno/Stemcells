/**
 * Stemcells' own settings pages, as upstream's settings lists read them
 * (`stemcells/seams.md`, Settings pages of our own): each one's path, its
 * name in the list, and its scope. A new page adds itself here, its icon
 * in `settingsIcons.ts`, and its route file; upstream's lists take it from
 * these.
 */

export type StemcellsSettingsPath = "/settings/disk" | "/settings/aski";

/** Each page's name in the settings list, in the list's order. */
export const STEMCELLS_SETTINGS_LABELS: Readonly<Record<StemcellsSettingsPath, string>> = {
  "/settings/disk": "Disk",
  "/settings/aski": "Aski",
};

/** No settings scope applies: Disk reads this machine, and Aski's switch lives on this device. */
export const STEMCELLS_SETTINGS_SCOPES: Readonly<Record<StemcellsSettingsPath, null>> = {
  "/settings/disk": null,
  "/settings/aski": null,
};

/** The pages whose header names no settings scope. */
export const STEMCELLS_DEVICE_ONLY_PATHS: readonly StemcellsSettingsPath[] = [
  "/settings/disk",
  "/settings/aski",
];
