/**
 * Upstream behaviour the concise model names rely on. A failure here after a
 * sync names the contract that moved; the fix goes in `modelNames.ts`,
 * `stemcells/models/names.ts` or the seam, not in the views.
 */
import { ProviderDriverKind } from "@t3tools/contracts";
import { formatCodexModelName, formatModelSlugName } from "@t3tools/shared/model";
import { describe, expect, it } from "vite-plus/test";

import providerIconUtilsSource from "../../components/chat/providerIconUtils.ts?raw";
import modelPickerContentSource from "../../components/chat/ModelPickerContent.tsx?raw";
import providerSubagentBarSource from "../../components/chat/ProviderSubagentBar.tsx?raw";
import subagentTooltipContentSource from "../../components/chat/SubagentTooltipContent.tsx?raw";
import providerModelsSectionSource from "../../components/settings/ProviderModelsSection.tsx?raw";
import {
  getDisplayModelName,
  getTriggerDisplayModelName,
} from "../../components/chat/providerIconUtils";
import manifestSource from "../../../../server/src/provider/model-manifest.json?raw";
import { conciseModelName } from "../models/names";
import { formatProviderUpdateRequiredNotice, resolveSubagentMetadata } from "./modelNames";

interface Manifest {
  readonly providers: Record<string, { readonly models: ReadonlyArray<{ readonly name: string }> }>;
}

const manifestNames = Object.values((JSON.parse(manifestSource) as Manifest).providers).flatMap(
  (catalog) => catalog.models.map((model) => model.name),
);

describe("concise model names' contracts with upstream", () => {
  it("knows the shape of every name in upstream's model manifest", () => {
    // Upstream refetches this manifest from its own repository, so a new model
    // arrives without a sync. A name the rule doesn't change would show with
    // its vendor word: teach the rule the new shape.
    expect(manifestNames.length).toBeGreaterThan(0);
    expect(manifestNames.filter((name) => conciseModelName(name) === name)).toEqual([]);
  });

  it("knows the names upstream builds from a slug", () => {
    // Views fall back to these when a model isn't in the provider's list.
    expect(conciseModelName(formatModelSlugName("claude-opus-5-5"))).toBe("Opus 5.5");
    expect(conciseModelName(formatModelSlugName("gpt-6.1-sol"))).toBe("Sol 6.1");
    expect(conciseModelName(formatCodexModelName("gpt-5.5"))).toBe("GPT 5.5");
    expect(conciseModelName(formatModelSlugName("gemini-3.8-flash-high"))).toBe("Flash 3.8 High");
    expect(conciseModelName(formatModelSlugName("gpt-5.3-codex-spark"))).toBe("Codex Spark 5.3");
    expect(conciseModelName(formatCodexModelName("gpt-5.3-codex-spark"))).toBe("Codex Spark 5.3");
  });

  it("the display funnel writes concise names, after dropping a sub-provider prefix", () => {
    // Picker rows, the composer's model button, the sidebar, the context
    // meter and lifecycle rows all name a model through these two.
    expect(getDisplayModelName({ slug: "gpt-6.1-sol", name: "GPT-6.1 Sol" })).toBe("Sol 6.1");
    expect(
      getDisplayModelName({
        slug: "anthropic/claude-opus-5-5",
        name: "Anthropic: Claude Opus 5.5",
        subProvider: "Anthropic",
      }),
    ).toBe("Opus 5.5");
    expect(
      getTriggerDisplayModelName({
        slug: "gemini-3.8-flash-high",
        name: "x",
        shortName: "Gemini 3.8 Flash (High)",
      }),
    ).toBe("Flash 3.8 High");
  });

  it("the update notice names models concisely", () => {
    const notice = formatProviderUpdateRequiredNotice({
      driver: ProviderDriverKind.make("claudeAgent"),
      updateRequiredModels: [
        { slug: "claude-fable-5-1", name: "Claude Fable 5.1", minVersion: "2.1.290" },
      ],
    });
    expect(notice).toContain("Fable 5.1");
    expect(notice).not.toContain("Claude Fable");
    // The search still matches what the notice shows.
    expect(
      formatProviderUpdateRequiredNotice(
        {
          driver: ProviderDriverKind.make("claudeAgent"),
          updateRequiredModels: [
            { slug: "claude-fable-5-1", name: "Claude Fable 5.1", minVersion: "2.1.290" },
          ],
        },
        "fable 5",
      ),
    ).not.toBeNull();
  });

  it("a subagent's tooltip names its model concisely, listed or not", () => {
    const listed = resolveSubagentMetadata({
      model: "claude-opus-5-5",
      provider: {
        driver: ProviderDriverKind.make("claudeAgent"),
        models: [
          { slug: "claude-opus-5-5", name: "Claude Opus 5.5", isCustom: false, capabilities: null },
        ],
      },
    });
    expect(listed.modelLabel).toBe("Opus 5.5");
    expect(resolveSubagentMetadata({ model: "claude-opus-5-5" }).modelLabel).toBe("Opus 5.5");
  });

  it("every view that names a model reads it through the seams", () => {
    // A sync that resolved a conflict in upstream's favour would bring a
    // vendor word back to that view.
    expect(providerIconUtilsSource).toContain(
      "return conciseModelName(stripLeadingQualifier(name, model.subProvider));",
    );
    expect(providerModelsSectionSource).toContain(
      "groupModelsForDisplay(models.map(withConciseName), {",
    );
    expect(providerSubagentBarSource).toContain(
      "const modelLabel = conciseModelName(props.modelLabel);",
    );
    expect(providerSubagentBarSource).not.toContain("{props.modelLabel}");
    expect(subagentTooltipContentSource).toContain(
      'import { resolveSubagentMetadata } from "../../stemcells/upstream/modelNames";',
    );
    expect(modelPickerContentSource).toContain(
      'import { formatProviderUpdateRequiredNotice } from "../../stemcells/upstream/modelNames";',
    );
  });
});
