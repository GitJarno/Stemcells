import { describe, expect, it, vi } from "vite-plus/test";

import { routeAgentNotificationResponseOnce } from "../../features/agent-awareness/notificationPayload";

/**
 * Contract: a push from the person's Mac (`apps/server/src/stemcells/push/Push.ts`)
 * carries the `body` upstream's relay sends, which Expo hands the app as
 * the notification's data, so a tap opens the Cell through upstream's own
 * handler.
 */

const fromTheMac = {
  environmentId: "env-1",
  threadId: "thread-1",
  deepLink: "/threads/env-1/thread-1",
};

describe("a push from the Mac", () => {
  it("opens its Cell when tapped, once", () => {
    const navigate = vi.fn();
    const handledResponseIds = new Set<string>();
    const response = {
      notification: { request: { identifier: "push-1", content: { data: fromTheMac } } },
    };
    routeAgentNotificationResponseOnce({ handledResponseIds, response, navigate });
    routeAgentNotificationResponseOnce({ handledResponseIds, response, navigate });
    expect(navigate.mock.calls).toEqual([["/threads/env-1/thread-1"]]);
  });
});
