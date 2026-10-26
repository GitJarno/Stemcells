/**
 * What the composer's light relies on in upstream: where it sits in the composer, what it reads
 * there (the glass's colour, the send button), which providers get a mark, and the outline the
 * focused pane's plate steps up. A failure after a sync names the contract that moved.
 */
import { describe, expect, it } from "vite-plus/test";

import chatComposer from "../../components/chat/ChatComposer.tsx?raw";
import footerControls from "../../components/chat/ComposerFooterControls.tsx?raw";
import composerSurface from "../../components/chat/ComposerSurface.tsx?raw";
import providerInstanceIcon from "../../components/chat/ProviderInstanceIcon.tsx?raw";
import { toneTokenOf } from "../glow/light";

/** The source of the function or memo named `name`, up to the next top-level one. */
function body(source: string, name: string): string {
  const start = source.search(new RegExp(`\\n(?:export )?(?:const|function) ${name}\\b`));
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source
    .slice(start + 1)
    .search(/\n(?:export )?(?:const|let|function|interface|type|class|enum) /);
  return source.slice(start, end < 0 ? undefined : start + 1 + end);
}

describe("the composer light's contracts with upstream", () => {
  it("is the first thing inside the composer's main surface, told the composer's provider", () => {
    expect(chatComposer).toMatch(
      /<ComposerSurface\.Main\b[^>]*>\s*<Stemcells\.CellComposerGlass provider=\{selectedProvider\} \/>\s*<div\s+ref=\{composerSurfaceRef\}/,
    );
  });

  it("the main surface carries the attribute glow.css names, and is a stacking context", () => {
    // The light's z-index -1 puts it over this surface's own background and
    // under the words only because the surface stacks its children.
    const main = body(composerSurface, "Main");
    expect(main).toContain('data-chat-composer-main-surface="true"');
    expect(main).toMatch(/"group relative z-10 rounded-3xl p-px"/);
    expect(main).toContain("{...props}");
  });

  it("the composer names its glass's colour in a property the light reads", () => {
    expect(body(composerSurface, "Shell")).toContain("[--chat-composer-glass-surface:");
  });

  it("the plate's outline is one property, which the focused pane's cue steps up", () => {
    const shell = body(composerSurface, "Shell");
    expect(shell).toContain('data-slot="composer-shell"');
    expect(shell).toContain("[--chat-composer-outline:");
    // The plate draws it, and so does the main surface under an upstream banner.
    expect(composerSurface).toContain("after:border-(--chat-composer-outline)");
    expect(body(composerSurface, "Host")).toContain("outlineClasses");
    expect(body(composerSurface, "Main")).toContain("outlineClasses");
  });

  it("the send button is the last button in the composer's trailing actions", () => {
    const opens = chatComposer.indexOf('data-chat-composer-actions="right"');
    expect(opens).toBeGreaterThanOrEqual(0);
    const actions = chatComposer.slice(opens);
    const closes = actions.search(/\n {16}<\/div>/);
    const components = [...actions.slice(0, closes).matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]);
    expect(components.at(-1)).toBe("ComposerFooterPrimaryActions");
    const footer = body(footerControls, "ComposerFooterPrimaryActions");
    const drawn = [...footer.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]);
    expect(drawn.at(-1)).toBe("ComposerPrimaryActions");
  });

  it("upstream draws Claude's and OpenAI's marks for the drivers the light names", () => {
    expect(providerInstanceIcon).toContain('[ProviderDriverKind.make("claudeAgent")]: ClaudeAI,');
    expect(providerInstanceIcon).toContain('[ProviderDriverKind.make("codex")]: OpenAI,');
    expect(toneTokenOf("claudeAgent")).toBe("--sc-provider-claude");
    expect(toneTokenOf("codex")).toBe("--sc-provider-codex");
  });
});
