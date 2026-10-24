/**
 * Substitutes upstream's `components/usage/UsageLimitsPooled.tsx`
 * (`plugin.ts`): the Usage page lists every plan a row each, as the rail's
 * hover does (`limits/PlanBoard.tsx`), where upstream pools each provider's
 * accounts into one card per window. Upstream's section still picks the
 * environments and providers shown; its notices, its "Manage usage" links,
 * its Cursor prompt and its reset credits stay as upstream draws them.
 */
import {
  CHATGPT_USAGE_URL,
  collectExternalUsageLinks,
  collectLimitNotices,
} from "@t3tools/shared/usageLimits";
import { AlertTriangleIcon, ExternalLinkIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { OpenAI } from "../../../components/Icons";
import { Alert, AlertTitle } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import * as Upstream from "../../../components/usage/UsageLimitsPooled";
import { ensureLocalApi } from "../../../localApi";
import { PlanBoard } from "../../limits/PlanBoard";
import { usePlans } from "../../limits/usePlans";
import { formatDuration, ResetCredits, useClockFormat } from "../limits";

export * from "../../../components/usage/UsageLimitsPooled";

export function UsageLimitsPooled(props: ComponentProps<typeof Upstream.UsageLimitsPooled>) {
  const { presentations, now, cursorPrompt } = props;
  const { plans } = usePlans(presentations, now);
  const clock = useClockFormat(now);
  const notices = collectLimitNotices(presentations);
  const externalLinks = collectExternalUsageLinks(presentations);
  return (
    <div className="flex flex-col gap-8">
      {plans.length === 0 && notices.length === 0 && !cursorPrompt && externalLinks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No provider on the selected environments reports subscription limits.
        </p>
      ) : null}
      {plans.length > 0 ? (
        <PlanBoard
          plans={plans}
          clocks={{ now, clock, duration: formatDuration }}
          size="page"
          renderUnder={(plan) => {
            const { redeem, limits } = plan.account;
            // As upstream's cards: reset credits only while there are some to use.
            return redeem && limits.resetCredits && limits.resetCredits.availableCount > 0 ? (
              <ResetCredits
                environmentId={redeem.environmentId}
                input={redeem.input}
                credits={limits.resetCredits}
                now={now}
              />
            ) : null;
          }}
        />
      ) : null}
      {cursorPrompt}
      {externalLinks.map((link) => (
        <section
          key={link.url}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {link.url === CHATGPT_USAGE_URL ? (
              <OpenAI className="size-5 shrink-0" aria-hidden="true" />
            ) : null}
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-medium">{link.label}</h2>
              {link.url === CHATGPT_USAGE_URL ? (
                <p className="text-xs text-muted-foreground">
                  View usage in ChatGPT with your connected account.
                </p>
              ) : link.message ? (
                <p className="max-w-xl text-xs text-muted-foreground">{link.message}</p>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost-muted"
            size="xs"
            onClick={() => void ensureLocalApi().shell.openExternal(link.url)}
          >
            Manage usage
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </section>
      ))}
      {notices.length > 0 ? (
        <Alert variant="warning" controlAlignment="first-line">
          <AlertTriangleIcon />
          {notices.map((notice) => (
            <AlertTitle key={notice} className="break-words">
              {notice}
            </AlertTitle>
          ))}
        </Alert>
      ) : null}
    </div>
  );
}
