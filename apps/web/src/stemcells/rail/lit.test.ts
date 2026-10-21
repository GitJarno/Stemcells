import { describe, expect, it } from "vite-plus/test";

import { litFor } from "./lit";

describe("the rail item lit for where you are", () => {
  it("lights the cog on every settings page but Disk, which the gauge opens", () => {
    expect(litFor("/settings/general")).toBe("settings");
    expect(litFor("/settings/archived")).toBe("settings");
    expect(litFor("/settings")).toBe("settings");
    expect(litFor("/settings/disk")).toBe("disk");
  });

  it("lights Usage on its page and nothing on a chat", () => {
    expect(litFor("/usage")).toBe("usage");
    expect(litFor("/env-1/thread-1")).toBeNull();
    expect(litFor("/settingsish")).toBeNull();
  });
});
