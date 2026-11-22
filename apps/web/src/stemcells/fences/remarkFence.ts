// A closed fence of one of our languages that reads leaves the parsed reply as a link upstream's
// markdown keeps, `t3-context://v1/<kind>/fence`, whose words are the fence's own: our renderer
// draws it. Any other fence stays upstream's code block, so one still streaming, or one that
// doesn't read, shows as written.
import type { Paragraph, Parent, Root } from "mdast";

export interface FenceKind {
  readonly lang: string;
  /** The context link's kind our renderer draws it by. */
  readonly kind: string;
  readonly reads: (source: string) => boolean;
}

const closedFence = (lang: string) =>
  new RegExp(
    `(?:^|\\n)[ \\t>]*(\`{3,}|~{3,}) *${lang}[^\\n]*\\n(?:[^\\n]*\\n)*?[ \\t>]*\\1[\`~]*[ \\t]*(?:\\n|$)`,
  );

/** Whether `text` may hold a closed fence of `lang`: only such a reply runs its plugin. */
export const mayHoldFence = (lang: string) => {
  const pattern = closedFence(lang);
  return (text: string) => pattern.test(text);
};

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

/** A remark plugin that hands each closed, reading fence of `kinds` to our renderer. */
export function remarkFences(kinds: ReadonlyArray<FenceKind>) {
  return () => (tree: Root, file: { readonly value: unknown }) => {
    const text = String(file.value);
    const visit = (parent: Parent) => {
      parent.children.forEach((child, index) => {
        if (child.type !== "code") {
          if ("children" in child) visit(child);
          return;
        }
        const kind = kinds.find((each) => each.lang === child.lang);
        const from = child.position?.start.offset;
        const to = child.position?.end.offset;
        if (kind === undefined || from === undefined || to === undefined) return;
        if (!closed(text.slice(from, to)) || !kind.reads(child.value)) return;
        // A block of its own, not a paragraph: a figure can't sit inside one.
        const drawn: Paragraph = {
          type: "paragraph",
          data: { hName: "div" },
          children: [
            {
              type: "link",
              url: `t3-context://v1/${kind.kind}/fence`,
              children: [{ type: "text", value: child.value }],
            },
          ],
        };
        parent.children[index] = drawn;
      });
    };
    visit(tree);
  };
}
