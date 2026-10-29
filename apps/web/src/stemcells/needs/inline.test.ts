import { describe, expect, it } from "vite-plus/test";

import { linkAddresses, marksUp, spansOf } from "./inline";

describe("an ask's words", () => {
  // A flagged ask: "buy acmecoffee.com should be a link. Escrow.com should be also a link."
  it("links a bare web address, and leaves files, paths and emails as words", () => {
    expect(linkAddresses("buy acmecoffee.com, through Escrow.com (one payment)")).toBe(
      "buy [acmecoffee.com](https://acmecoffee.com), through [Escrow.com](https://Escrow.com) (one payment)",
    );
    for (const words of [
      "edit notes.md and install.sh",
      "see src/app.com/x",
      "mail ops@acme.com",
      "run `npm i acme.com`",
      "open [the docs](https://docs.acme.dev/start) now",
      "at https://acme.com/a.",
    ]) {
      expect(
        spansOf(words).filter((span) => span.kind === "link" && span.url.endsWith(".com")),
      ).toEqual([]);
    }
    expect(linkAddresses("go to acme.dev/pricing.")).toBe(
      "go to [acme.dev/pricing](https://acme.dev/pricing).",
    );
  });

  it("splits links, code and bold for the phone, in order", () => {
    expect(spansOf("Open [DomainShop](https://domainshop.com), click **Buy**, run `ls`.")).toEqual([
      { kind: "text", text: "Open " },
      { kind: "link", text: "DomainShop", url: "https://domainshop.com" },
      { kind: "text", text: ", click " },
      { kind: "strong", text: "Buy" },
      { kind: "text", text: ", run " },
      { kind: "code", text: "ls" },
      { kind: "text", text: "." },
    ]);
    expect(marksUp("quit and reopen the desktop app")).toBe(false);
  });
});
