import { describe, expect, it } from "vite-plus/test";

import { fromWindowPage } from "./senders.ts";

function contents(type: string) {
  const mainFrame = { name: `${type} top` };
  return { getType: () => type, mainFrame };
}

describe("fromWindowPage", () => {
  it("hears a window's page from its top frame", () => {
    const sender = contents("window");
    expect(fromWindowPage({ sender, senderFrame: sender.mainFrame })).toBe(true);
  });

  it("refuses a browser preview's guest, which can reach ipcRenderer", () => {
    const sender = contents("webview");
    expect(fromWindowPage({ sender, senderFrame: sender.mainFrame })).toBe(false);
  });

  it("refuses a frame inside a window's page, and a frame already gone", () => {
    const sender = contents("window");
    expect(fromWindowPage({ sender, senderFrame: { name: "inner" } })).toBe(false);
    expect(fromWindowPage({ sender, senderFrame: null })).toBe(false);
  });
});
