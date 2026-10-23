// @effect-diagnostics nodeBuiltinImport:off - the test reads the token sheet.
import * as NodeFS from "node:fs";

import { ProviderDriverKind } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import chart from "../../../components/usage/UsageProviderChart.tsx?raw";
import limits from "../../../components/usage/UsageLimits.tsx?raw";
import pooled from "../../../components/usage/UsageLimitsPooled.tsx?raw";
import page from "../../../components/usage/UsagePage.tsx?raw";
import { barColor } from "../../../components/usage/UsageLimits";
import * as Upstream from "../../../components/usage/usageProviders";
import { toneTokenOf } from "../../glow/light";
import { PROVIDER_PRESENTATION } from "./usageProviders";

const tokens = NodeFS.readFileSync(new URL("../../tokens/stemcells.css", import.meta.url), "utf8");

/** A token's value as the sheet declares it, or `null` when it declares none. */
const tokenValue = (name: string) =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim() ?? null;

describe("the usage page's provider colours", () => {
  it("draws Codex teal where upstream's views read it, never upstream's white", () => {
    // `UsageLimits.tsx` is upstream's, and its `./usageProviders` is ours only
    // through the substitute: unwired, Codex reads `--contrast-foreground` again.
    const codex = barColor(ProviderDriverKind.make("codex"));
    expect(codex).not.toBe(Upstream.PROVIDER_PRESENTATION.codex.color);
    expect(codex).toBe("var(--sc-provider-codex)");
    expect(tokenValue("--sc-provider-codex")).toBe("rgba(16, 163, 127, 1)");
  });

  it("draws each branded provider in the colour its composer's light wears", () => {
    expect(PROVIDER_PRESENTATION.claude.color).toBe(`var(${toneTokenOf("claudeAgent")})`);
    expect(PROVIDER_PRESENTATION.codex.color).toBe(`var(${toneTokenOf("codex")})`);
    expect(tokenValue("--sc-provider-claude")).not.toBeNull();
  });

  it("draws a provider with no colour of its own neutral", () => {
    for (const provider of ["grok", "cursor", "opencode", "antigravity", "pi"] as const) {
      expect(PROVIDER_PRESENTATION[provider].color, provider).toBe("var(--sc-dim)");
    }
  });

  it("keeps upstream's providers, order, names and drivers", () => {
    expect(Object.keys(PROVIDER_PRESENTATION)).toEqual(Object.keys(Upstream.PROVIDER_PRESENTATION));
    for (const [provider, presentation] of Object.entries(Upstream.PROVIDER_PRESENTATION)) {
      const ours = PROVIDER_PRESENTATION[provider as keyof typeof PROVIDER_PRESENTATION];
      expect(ours.label, provider).toBe(presentation.label);
      expect(ours.driverKind, provider).toBe(presentation.driverKind);
    }
  });
});

// Upstream's marks take a provider's colour from `PROVIDER_PRESENTATION`
// alone, so the substitute reaches all of them. A failure names the mark
// that moved, which would draw upstream's colour again.
describe("upstream's usage marks, as the substitute colours them", () => {
  it("the chart's area under each line, at its quiet alpha, and the line", () => {
    expect(chart).toMatch(
      /fill=\{PROVIDER_PRESENTATION\[provider\]\.color\}\s+fillOpacity=\{0\.12\}/,
    );
    expect(chart).toContain("stroke={PROVIDER_PRESENTATION[provider].color}");
  });

  it("the models' bars", () => {
    expect(page).toContain("backgroundColor: PROVIDER_PRESENTATION[model.provider].color");
  });

  it("the legend's key is the provider's Cell, with no dot beside it", () => {
    // The Cell (`ProviderInstanceIcon.tsx`) wears the colour the dot did (`seams.md`).
    expect(page).not.toContain("backgroundColor: PROVIDER_PRESENTATION[provider].color");
    expect(page).toContain('<ProviderMark provider={provider} className="size-4" />');
  });

  it("the plan bars and their rows, which read the provider's colour by driver", () => {
    expect(limits).toMatch(/presentation\?\.color \?\? "var\(--foreground\)"/);
    expect(pooled).toContain("const color = barColor(pool.driver);");
  });
});
