/**
 * A closed `chart` fence that reads as a chart leaves the parsed reply as a link upstream's
 * markdown keeps, `t3-context://v1/stemcells-chart/fence`, whose words are the fence's own:
 * our renderer draws it (`ChartFence.tsx`). Any other fence stays upstream's code block, so one
 * still streaming, or one that doesn't read, shows as written.
 */
import type { Paragraph, Parent, Root } from "mdast";

import { parseChart } from "../../../../../stemcells/chart/parse.ts";

/** The context link's kind for a chart: `t3-context://v1/stemcells-chart/fence`. */
export const CHART_LINK_KIND = "stemcells-chart";
const CHART_HREF = `t3-context://v1/${CHART_LINK_KIND}/fence`;

const CLOSED_CHART =
  /(?:^|\n)[ \t>]*(`{3,}|~{3,}) *chart[^\n]*\n(?:[^\n]*\n)*?[ \t>]*\1[`~]*[ \t]*(?:\n|$)/;

/** Whether `text` may hold a closed chart fence: only such a reply runs the plugin. */
export const mayHoldChart = (text: string) => CLOSED_CHART.test(text);

/** A fence as written ends in its closing line; one still streaming ends in its last row. */
function closed(written: string): boolean {
  const lines = written.split("\n");
  const open = /^(`{3,}|~{3,})/.exec(lines[0]!)?.[1];
  const close = /^[ \t>]*(`{3,}|~{3,})[ \t]*$/.exec(lines[lines.length - 1]!)?.[1];
  return (
    lines.length > 1 &&
    open !== undefined &&
    close !== undefined &&
    close[0] === open[0] &&
    close.length >= open.length
  );
}

export function remarkChartFence() {
  return (tree: Root, file: { readonly value: unknown }) => {
    const text = String(file.value);
    const visit = (parent: Parent) => {
      parent.children.forEach((child, index) => {
        if (child.type !== "code") {
          if ("children" in child) visit(child);
          return;
        }
        const from = child.position?.start.offset;
        const to = child.position?.end.offset;
        if (child.lang !== "chart" || from === undefined || to === undefined) return;
        if (!closed(text.slice(from, to)) || parseChart(child.value) === null) return;
        // A block of its own, not a paragraph: a figure can't sit inside one.
        const drawn: Paragraph = {
          type: "paragraph",
          data: { hName: "div" },
          children: [
            { type: "link", url: CHART_HREF, children: [{ type: "text", value: child.value }] },
          ],
        };
        parent.children[index] = drawn;
      });
    };
    visit(tree);
  };
}
