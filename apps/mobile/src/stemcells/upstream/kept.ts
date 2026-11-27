// Small files of ours on the phone: what it keeps for itself between launches (the home's picks,
// a preview's switch). On its own, away from the home's adapter, so a module any view reaches
// can read one without taking the home's upstream with it.

import { Directory, File, Paths } from "expo-file-system";

import { writeFileAtomically } from "../../lib/atomic-file";

const keptFile = (name: string) => new File(new Directory(Paths.document, "stemcells"), name);

/** A small file of ours on the phone, read whole; null when there's none yet. */
export function readKept(name: string): string | null {
  try {
    const file = keptFile(name);
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

/** Writes a small file of ours whole, so a crash mid-write leaves the last one. */
export function writeKept(name: string, text: string): Promise<void> {
  return writeFileAtomically(keptFile(name), text).catch(() => undefined);
}
