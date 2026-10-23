import { describe, expect, it } from "vite-plus/test";

import { linkedCell } from "./peeking";

describe("the Cell a link in Aski's chat names", () => {
  it("is the thread of a chat link on this server", () => {
    expect(linkedCell("/env-local/thread-floof", "env-local")).toBe("thread-floof");
    expect(linkedCell("/env%20one/thread%3A7", "env one")).toBe("thread:7");
  });

  it("is read from the hash in the desktop app, which routes by it", () => {
    expect(linkedCell("/index.html#/env-local/thread-floof", "env-local")).toBe("thread-floof");
    expect(linkedCell("/#/env-local/thread-floof?pane=1", "env-local")).toBe("thread-floof");
  });

  it("is none on another server, or for a link that names no chat", () => {
    expect(linkedCell("/env-remote/thread-floof", "env-local")).toBeNull();
    expect(linkedCell("/settings/providers", "env-local")).toBeNull();
    expect(linkedCell("/env-local/thread-floof/files", "env-local")).toBeNull();
    expect(linkedCell(null, "env-local")).toBeNull();
  });
});
