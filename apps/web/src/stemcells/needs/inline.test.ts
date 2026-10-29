import { describe, expect, it } from "vite-plus/test";

import { linkAddresses, marksUp, spansOf } from "./inline";

describe("an ask's words", () => {
  // A flagged ask: the domain to buy, and where to pay for it, should both be links.
  it("links a bare web address, and leaves files, paths and emails as words", () => {
    expect(linkAddresses("buy acme-tools.dev, through Escrow.com (one payment)")).toBe(
      "buy [acme-tools.dev](https://acme-tools.dev), through [Escrow.com](https://Escrow.com) (one payment)",
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
    expect(
      spansOf("Open [the listing](https://example-registrar.com), click **Buy**, run `ls`."),
    ).toEqual([
      { kind: "text", text: "Open " },
      { kind: "link", text: "the listing", url: "https://example-registrar.com" },
      { kind: "text", text: ", click " },
      { kind: "strong", text: "Buy" },
      { kind: "text", text: ", run " },
      { kind: "code", text: "ls" },
      { kind: "text", text: "." },
    ]);
    expect(marksUp("quit and reopen the desktop app")).toBe(false);
  });

  it("links #123 into the Cell's repository, and nothing else that looks like one", () => {
    const repo = "https://github.com/acme/app";
    expect(linkAddresses("review #58, then close #57.", repo)).toBe(
      `review [#58](${repo}/issues/58), then close [#57](${repo}/issues/57).`,
    );
    for (const words of ["see `#58`", "color #fff", "step#2", "&#58;", "a/#58", "##58"]) {
      expect(spansOf(words, repo).some((span) => span.kind === "link")).toBe(false);
    }
    expect(marksUp("review #58")).toBe(false);
  });
});
