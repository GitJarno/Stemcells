/**
 * The forms text reaches every agent as one of upstream's instruction sections (`seams.md`, The
 * close-out), and teaches only what the clients draw. A failure names what moved: the section's
 * place, the tool it sends a bespoke visual to, or the chart fence's own limits.
 */
import {
  T3_CODE_ORCHESTRATION_INSTRUCTIONS,
  T3_CODE_ORCHESTRATION_SECTIONS,
} from "@t3tools/provider-core/server/orchestrationInstructions";
import { HTML_RENDER_TOOL_NAME } from "@t3tools/shared/htmlRender";
import { describe, expect, it } from "vite-plus/test";

import { MAX_SERIES, parseChart } from "../../../../../stemcells/chart/parse.ts";

const at = T3_CODE_ORCHESTRATION_SECTIONS.findIndex((section) => section.startsWith("### Forms"));
const forms = T3_CODE_ORCHESTRATION_SECTIONS[at] ?? "";

describe("the forms every agent is taught", () => {
  it("is one of upstream's sections, after upstream's own and before the close-out", () => {
    expect(T3_CODE_ORCHESTRATION_INSTRUCTIONS).toContain(forms);
    // A level-three heading: it reads on from upstream's last section, which is one too.
    expect(T3_CODE_ORCHESTRATION_SECTIONS[at - 1]).toMatch(/^### Visuals and preview/);
    expect(at).toBe(T3_CODE_ORCHESTRATION_SECTIONS.length - 2);
  });

  it("sends a bespoke visual to the tool upstream draws pages with", () => {
    expect(forms).toContain(`\`${HTML_RENDER_TOOL_NAME}\``);
    expect(T3_CODE_ORCHESTRATION_SECTIONS[at - 1]).toContain(`\`${HTML_RENDER_TOOL_NAME}\``);
  });

  it("teaches the chart fence the clients read", () => {
    expect(MAX_SERIES).toBe(4);
    expect(forms).toContain("four at most");
    const [, first, unit] = /Its first line is `(bar): <title>`.+as in `(\w+ \(\w+\))`/.exec(
      forms,
    )!;
    const taught = [`${first}: A title`, `| Label | ${unit} |`, "| --- | --- |", "| a | 1 |"];
    expect(parseChart(taught.join("\n"))).toMatchObject({
      kind: "bar",
      title: "A title",
      series: [{ name: "Time", unit: "ms" }],
    });
    expect(parseChart(taught.join("\n").replace("bar:", "line:"))?.kind).toBe("line");
  });
});
