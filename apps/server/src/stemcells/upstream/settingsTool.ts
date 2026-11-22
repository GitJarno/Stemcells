/**
 * `stemcells_settings`: what a setting is set to on this machine, so a Cell checks before it
 * answers about one (stemcells/tasks/settings-in-chat.md). Read only: a change is the person's,
 * through a reply's `setting` fence. Reads upstream's server settings and provider registry.
 */
import { OrchestratorMcpFailure, ServerSettings as ServerSettingsSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as McpSchema from "effect/ai/McpSchema";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";

import type { SchemaAst } from "../../../../../stemcells/settings/controls.ts";
import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccess from "../../mcp/McpToolAccess.ts";
import * as ProviderRegistry from "../../provider/ProviderRegistry.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { settingsReport } from "../settings/report.ts";

const SettingsTool = Tool.make("stemcells_settings", {
  description:
    "What Stemcells settings are set to on this machine: read one before you answer about it. Name each as Settings does, such as `Threads › Auto-settle merged threads` or `Providers › Codex`; a provider reads as on or off, signed in or not, and its models. Read only: to change one, show it in a `setting` fence for the person to apply.",
  parameters: Schema.Struct({
    paths: Schema.Array(Schema.String)
      .check(Schema.isMinLength(1), Schema.isMaxLength(20))
      .annotate({ description: "Each setting or provider, as Settings names it." }),
  }),
  success: Schema.Struct({ report: Schema.String }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "Read Stemcells settings")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  // It acts as the Cell that calls it, so a client outside the app is never offered it.
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);

export const SettingsToolkit = Toolkit.make(SettingsTool);

const FIELDS = ServerSettingsSchema.fields as unknown as Readonly<
  Record<string, { readonly ast: SchemaAst }>
>;

const handlers = McpToolAccess.toLayer(
  SettingsToolkit,
  Effect.gen(function* () {
    const settings = yield* ServerSettings.ServerSettingsService;
    const registry = yield* Effect.serviceOption(ProviderRegistry.ProviderRegistry);
    return {
      stemcells_settings: McpToolAccess.readsAsCaller(
        ({ paths }: { readonly paths: ReadonlyArray<string> }) =>
          Effect.gen(function* () {
            const values = (yield* settings.getSettings) as unknown as Readonly<
              Record<string, unknown>
            >;
            const providers = Option.isSome(registry) ? yield* registry.value.getProviders : [];
            const report = settingsReport(paths, {
              server: (key) =>
                Object.hasOwn(FIELDS, key) ? { ast: FIELDS[key]!.ast, value: values[key] } : null,
              providers,
            });
            return { report };
          }).pipe(
            Effect.mapError(
              (error) =>
                new OrchestratorMcpFailure({ code: "orchestration_error", message: error.message }),
            ),
          ),
      ),
    };
  }),
);

export const registerSettingsTool = (register: typeof toolkitRegistration) =>
  register(SettingsToolkit, handlers);
