import { describe, expect, it } from "vite-plus/test";

import { briefOf, labelOf, LEAD_CAP } from "./brief.ts";
import { stopOf } from "./closeOut.ts";

const briefFor = (reply: string) => briefOf(reply, [stopOf(reply).ask?.text ?? ""]);

describe("what an ask carries from the rest of its reply", () => {
  // The reply behind a flagged ask: its step said "buy acmecoffee.com" with no link, though the
  // reply had one.
  it("brings the reply's opening and the link the step needs", () => {
    const reply = [
      "Yes, it's a normal web checkout. DomainShop sells acmecoffee.com at a fixed price.",
      "",
      "**How it works:**",
      "1. Open [domainshop.com/domain_profile.cfm?d=acmecoffee.com](https://www.domainshop.com/domain_profile.cfm?d=acmecoffee.com).",
      "2. Click **Buy now**. See ![the cart](https://example.com/cart.png).",
      "",
      "**Left:**",
      "- you: buy acmecoffee.com, through Escrow.com (one payment) or the payment plan",
    ].join("\n");
    expect(briefFor(reply)).toEqual({
      lead: "Yes, it's a normal web checkout. DomainShop sells acmecoffee.com at a fixed price.",
      links: [
        {
          label: "domainshop.com/domain_profile.cfm",
          url: "https://www.domainshop.com/domain_profile.cfm?d=acmecoffee.com",
        },
      ],
    });
  });

  it("skips a lead the ask already quotes, and an opening that is a table or heading", () => {
    expect(briefFor("Should I push it?").lead).toBeNull();
    expect(briefFor("| PR | What |\n|---|---|\n\n**Left:** you: restart the app").lead).toBeNull();
    expect(briefFor("## Summary\n\nAll merged.\n\n**Left:** you: restart the app").lead).toBe(
      "All merged.",
    );
  });

  it("cuts a long lead at a sentence, and names a link as the Cell did", () => {
    const long = `${"Built it. ".repeat(50)}Then more.`;
    const { lead } = briefFor(`${long}\n\n**Left:** you: restart the app`);
    expect(lead!.length).toBeLessThanOrEqual(LEAD_CAP);
    expect(lead!.endsWith("Built it.")).toBe(true);
    expect(labelOf("PR #887", "https://github.com/acme/app/pull/887")).toBe("PR #887");
    expect(labelOf("", "https://github.com/acme/app/pull/887/")).toBe(
      "github.com/acme/app/pull/887",
    );
  });

  it("keeps the last few links, each once, and none the ask's words already carry", () => {
    const reply = [
      "Both consoles are set up.",
      "",
      "See https://a.example/1, https://b.example/2 and [c](https://c.example/3).",
      "Again https://a.example/1 and https://d.example/4.",
      "",
      "**Left:** you: sign in at [the console](https://e.example/5)",
    ].join("\n");
    expect(briefFor(reply).links.map((link) => link.url)).toEqual([
      "https://b.example/2",
      "https://c.example/3",
      "https://d.example/4",
    ]);
  });
});
