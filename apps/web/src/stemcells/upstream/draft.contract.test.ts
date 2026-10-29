/**
 * Upstream behaviour a draft in a pane relies on: workspace.css moves an
 * unsent chat's composer to the pane's foot and quiets its headline, and a
 * sent one becomes its thread. A failure here after a sync names what moved:
 * the draft is back mid-pane, shouting, or stuck a draft once sent.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import draftHeroHeadline from "../../components/chat/DraftHeroHeadline.tsx?raw";
import draftHeroProjectHeading from "../../components/chat/DraftHeroProjectHeading.tsx?raw";
import threadRouteView from "../../components/ThreadRouteView.tsx?raw";

describe("a draft's contracts with upstream", () => {
  it("a draft's composer overlay fills the chat and centres its lane with flex", () => {
    // The pane's `align-items: flex-end` moves the lane to the foot. A sent
    // chat's overlay is no flex box, so the same rule leaves it alone.
    expect(chatView).toContain('data-chat-composer-overlay="true"');
    expect(chatView).toContain('"pointer-events-none absolute inset-0 z-20 flex items-center"');
    expect(chatView).toContain(
      '"pointer-events-none absolute inset-x-0 bottom-0 z-20 pt-1.5 sm:pt-2"',
    );
  });

  it("the headline hangs over the composer from the stack's first child", () => {
    // workspace.css finds it as `[data-chat-composer-stack="true"] > .bottom-full`.
    expect(chatView).toMatch(
      /data-chat-composer-stack="true"[\s\S]{0,400}\{isDraftHeroState \? \(\s*<div className="absolute inset-x-0 bottom-full">[\s\S]{0,600}<DraftHeroHeadline/,
    );
  });

  it("sent and let go, a draft's route view keeps its chat and moves the route on to the thread", () => {
    // A pane holding the draft renders that view (`useCellPresence`); the route
    // it moves to gives the pane its thread (`showRoute`).
    expect(threadRouteView).toMatch(
      /\} else if \(draftRedirect\) \{[\s\S]{0,400}key=\{target\.draftId\}[\s\S]{0,400}<Navigate\s+to="\/\$environmentId\/\$threadId"\s+params=\{buildThreadRouteParams\(draftRedirect\)\}/,
    );
    expect(threadRouteView).toContain("{background ? null : redirect}");
  });

  it("the headline takes its sizes from Tailwind's theme sizes, which the pane lowers", () => {
    for (const source of [draftHeroHeadline, draftHeroProjectHeading]) {
      expect(source).toMatch(
        /<h1 className="[^"]*\btext-2xl text-foreground tracking-tight sm:text-3xl\b/,
      );
    }
    // The inline fit is measured at text-3xl, so the lowered size fits too.
    expect(draftHeroProjectHeading).toContain(
      "whitespace-nowrap font-normal text-3xl tracking-tight",
    );
    expect(draftHeroProjectHeading).toContain("text-base tracking-normal");
  });
});
