// What `stemcells_settings` answers (stemcells/tasks/settings-in-chat.md): each path read as a
// reply's `setting` fence reads it, then what it's set to on this machine, in a card's words.
// A setting the person's own device keeps, the server can't read, so it says so.
import {
  BINDINGS,
  controlOf,
  valueLabel,
  type SchemaAst,
} from "../../../../../stemcells/settings/controls.ts";
import { readSettingFence } from "../../../../../stemcells/settings/fence.ts";
import { crumbsFor } from "../../../../../stemcells/settings/places.ts";
import {
  modelsLine,
  providerStanding,
  type ProviderFacts,
} from "../../../../../stemcells/settings/providers.ts";

export interface MachineSettings {
  /** A server setting's schema and value; null for a key it hasn't. */
  readonly server: (key: string) => { readonly ast: SchemaAst; readonly value: unknown } | null;
  readonly providers: ReadonlyArray<
    ProviderFacts & {
      readonly instanceId: string;
      readonly auth: { readonly label?: string | undefined };
    }
  >;
}

/** One line a path: where it is in Settings, then what it's set to here. */
export function settingsReport(paths: ReadonlyArray<string>, machine: MachineSettings): string {
  return paths.map((path) => lineFor(path, machine)).join("\n");
}

function lineFor(path: string, machine: MachineSettings): string {
  const [line] = readSettingFence(path) ?? [];
  if (line === undefined || !("place" in line)) return `${path}: no place in Settings reads so.`;
  const { place } = line;
  const name = crumbsFor(place).join(" › ");
  if (place.kind === "page") return `${name}: a page; name a setting on it.`;
  if (place.kind === "provider") {
    // The default instance's id is its driver's.
    const provider = machine.providers.find((each) => each.instanceId === place.driver);
    if (provider === undefined) return `${name}: not on this machine.`;
    const standing = providerStanding(provider);
    const plan = standing === "Signed in" && provider.auth.label ? ` · ${provider.auth.label}` : "";
    const models = modelsLine(provider);
    return `${name}: ${standing}${plan}${models === null ? "" : `; models: ${models}`}.`;
  }
  const binding = BINDINGS[place.id];
  const read = binding?.store === "server" ? machine.server(binding.key) : null;
  const control = read === null ? null : controlOf(read.ast);
  if (read !== null && control !== null) return `${name}: ${valueLabel(control, read.value)}.`;
  if (binding !== undefined)
    return `${name}: kept on the person's own device, which only their app reads; a setting fence shows it live.`;
  return `${name}: no value this tool reads; a setting fence opens it in Settings.`;
}
