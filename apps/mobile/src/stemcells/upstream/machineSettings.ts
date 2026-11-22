// What a reply's setting card takes from upstream on the phone (stemcells/tasks/settings-in-chat.md):
// the settings of the machine the chat runs on, whether this phone may change one, and the write
// the phone's Settings makes, under the same grant and organisation lock.
import {
  AuthSettingsWriteScope,
  EnvironmentId,
  isManagedSettingPath,
  ServerSettings,
  type ServerSettingsPatch,
} from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { useMemo } from "react";

import type { SchemaAst } from "../../../../../stemcells/settings/controls.ts";
import type { ProviderFacts } from "../../../../../stemcells/settings/providers.ts";
import { useEnvironments } from "../../state/environments";
import { environmentPresentations } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { useEnvironmentsWithScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";

export { ThemedSwitch } from "../../components/ui/ThemedSwitch";

const FIELDS = ServerSettings.fields as unknown as Readonly<Record<string, { ast: SchemaAst }>>;

/** A server setting's schema, as a card reads its control; null if there is none. */
export function serverSettingAst(key: string): SchemaAst | null {
  return Object.hasOwn(FIELDS, key) ? FIELDS[key]!.ast : null;
}

export interface MachineSetting {
  readonly value: unknown;
  /** Why this phone can't change it now; null when it can. */
  readonly locked: string | null;
  readonly set: (value: boolean | string | null) => void;
}

/** One setting of the chat's machine; null while the phone hasn't its settings. */
export function useMachineSetting(environmentId: string, key: string): MachineSetting | null {
  const { environments } = useEnvironments();
  const environment = environments.find((each) => each.environmentId === environmentId);
  const one = useMemo(
    () => [{ environmentId: EnvironmentId.make(environmentId) }],
    [environmentId],
  );
  const writable = useEnvironmentsWithScope(one, AuthSettingsWriteScope);
  const update = useAtomCommand(serverEnvironment.updateSettings, {
    label: "Setting from a reply",
    reportFailure: true,
  });
  const config = environment?.serverConfig;
  if (environment === undefined || config == null) return null;
  const policy = config.managedPolicy;
  const locked = isManagedSettingPath(policy, key)
    ? `Managed by ${policy?.organization ?? "your organisation"}.`
    : environment.connection.phase !== "connected"
      ? "Not connected."
      : writable.has(environment.environmentId)
        ? null
        : "This phone may not change it.";
  return {
    value: (config.settings as Readonly<Record<string, unknown>>)[key],
    locked,
    set: (value) =>
      void update({
        environmentId: environment.environmentId,
        input: { patch: { [key]: value } as ServerSettingsPatch },
      }),
  };
}

/** A provider's default instance on the chat's machine; null while the phone hasn't heard of it. */
export function useMachineProvider(environmentId: string, driver: string): ProviderFacts | null {
  const providers = useAtomValue(environmentPresentations.providersByEnvironmentAtom);
  // The default instance's id is its driver's.
  return (
    providers.get(EnvironmentId.make(environmentId))?.find((each) => each.instanceId === driver) ??
    null
  );
}
