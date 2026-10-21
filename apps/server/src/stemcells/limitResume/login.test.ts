import { describe, expect, it } from "vite-plus/test";

import { accountOf, keychainDateOf, keychainService } from "./login.ts";

describe("Claude's login, as the resume reads it", () => {
  it("names the keychain item as Claude Code does: shared, or one per config folder", () => {
    expect(keychainService({})).toBe("Claude Code-credentials");
    // The suffix is the start of the folder's SHA-256.
    const folder = "/Users/example/.claude-work";
    expect(keychainService({ CLAUDE_CONFIG_DIR: folder })).toBe("Claude Code-credentials-dd1118a7");
    expect(
      keychainService({ CLAUDE_CONFIG_DIR: folder, CLAUDE_SECURESTORAGE_CONFIG_DIR: "" }),
    ).toBe("Claude Code-credentials");
  });

  it("reads only the item's modification date from its attributes", () => {
    const attributes = [
      'keychain: "/Users/example/Library/Keychains/login.keychain-db"',
      "attributes:",
      '    "cdat"<timedate>=0x32303236303631323038323933375A00  "20260612082937Z\\000"',
      '    "mdat"<timedate>=0x32303236313032313135323030315A00  "20261021152001Z\\000"',
      '    "svce"<blob>="Claude Code-credentials"',
    ].join("\n");
    expect(keychainDateOf(attributes)).toBe("20261021152001Z");
    expect(keychainDateOf("security: SecKeychainSearchCopyNext: not found")).toBeNull();
  });

  it("keeps the account as a hash, the same for the same account and plan", () => {
    const status = (email: string, plan = "max") =>
      JSON.stringify({
        loggedIn: true,
        authMethod: "claude.ai",
        apiProvider: "firstParty",
        email,
        orgId: "org-example",
        orgName: "Example",
        subscriptionType: plan,
      });
    const first = accountOf(status("first@example.com"));
    expect(first).toMatch(/^[0-9a-f]{16}$/);
    expect(accountOf(status("first@example.com"))).toBe(first);
    expect(accountOf(status("second@example.com"))).not.toBe(first);
    expect(accountOf(status("first@example.com", "pro"))).not.toBe(first);
  });

  it("has no account when nobody is signed in or the answer can't be read", () => {
    expect(accountOf(JSON.stringify({ loggedIn: false, authMethod: "none" }))).toBeNull();
    expect(accountOf("Not logged in")).toBeNull();
    expect(accountOf("null")).toBeNull();
  });
});
