import { describe, expect, it } from "vite-plus/test";

import { leadOf, LEAD_CAP } from "./brief.ts";
import { stopOf } from "./closeOut.ts";

const leadFor = (reply: string) => leadOf(reply, [stopOf(reply).ask?.text ?? ""]);

describe("what an ask carries from the rest of its reply", () => {
  // A flagged ask said only its step; what the Cell had found was in the reply above it.
  it("brings the reply's opening paragraph", () => {
    const reply = [
      "Yes, it's a normal web checkout. Example Registrar sells acme-tools.dev at a fixed price.",
      "",
      "**How it works:**",
      "1. Open [the listing](https://www.example-registrar.com/domain/acme-tools.dev).",
      "",
      "**Left:**",
      "- you: buy acme-tools.dev, through Escrow.com (one payment) or the payment plan",
    ].join("\n");
    expect(leadFor(reply)).toBe(
      "Yes, it's a normal web checkout. Example Registrar sells acme-tools.dev at a fixed price.",
    );
  });

  it("skips a lead the ask already quotes, and an opening that is a table or heading", () => {
    expect(leadFor("Should I push it?")).toBeNull();
    expect(leadFor("| PR | What |\n|---|---|\n\n**Left:** you: restart the app")).toBeNull();
    expect(leadFor("## Summary\n\nAll merged.\n\n**Left:** you: restart the app")).toBe(
      "All merged.",
    );
  });

  it("cuts a long lead at a sentence", () => {
    const long = `${"Built it. ".repeat(50)}Then more.`;
    const lead = leadFor(`${long}\n\n**Left:** you: restart the app`);
    expect(lead!.length).toBeLessThanOrEqual(LEAD_CAP);
    expect(lead!.endsWith("Built it.")).toBe(true);
  });
});
