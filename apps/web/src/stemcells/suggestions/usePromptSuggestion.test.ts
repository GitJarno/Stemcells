import { describe, expect, it } from "vite-plus/test";

import { MessageId } from "../upstream/suggestions";
import { replyToFollow } from "./usePromptSuggestion";

const said = (id: string, role: "user" | "assistant" | "system", streaming = false) => ({
  id: MessageId.make(id),
  role,
  streaming,
});

describe("replyToFollow", () => {
  it("is the Cell's last reply once it's done and the Cell is idle", () => {
    expect(replyToFollow([said("ask", "user"), said("reply", "assistant")], "ready")).toBe("reply");
  });

  it("is none while the Cell works, after the person's own words, or after the app's", () => {
    const replied = [said("ask", "user"), said("reply", "assistant")];
    expect(replyToFollow(replied, "running")).toBeNull();
    expect(
      replyToFollow([...replied.slice(0, 1), said("reply", "assistant", true)], "ready"),
    ).toBeNull();
    expect(replyToFollow([...replied, said("next", "user")], "ready")).toBeNull();
    expect(replyToFollow([...replied, said("compacted", "system")], "ready")).toBeNull();
  });
});
