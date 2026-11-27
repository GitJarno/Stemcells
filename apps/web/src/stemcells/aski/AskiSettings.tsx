import { KINDS, setTaking, useAutonomy, type Kind } from "../autonomy/autonomy";
import { PhoneSettings } from "../push/PhoneSettings";
import { SettingsPageContainer, SettingsRow, SettingsSection, Switch } from "../upstream/settings";
import { useEffect, useState } from "react";

import { CEILING } from "../../../../../stemcells/orchestrator/plan.ts";
import { forgetLearned, type LearnedNames, readLearned } from "../upstream/askiPlans";
import { Button } from "../upstream/ui";
import { AsksMeasure } from "./AsksMeasure";
import { setCheckAlways, setPlanCap, useCheckAlways, usePlanCap } from "./plan/settings";
import { setAskiPlans, useAskiPlans } from "./planning";
import { setAskiTabOn, useAskiTabOn } from "./tabSwitch";
import { ASKI_SWITCHES } from "./settingLinks";

// Settings › Aski: whether Aski divides the work, what Aski takes for the person
// (stemcells/tasks/aski-autonomy.md), whether asks say enough (stemcells/tasks/aski-asks.md), and
// pushes to their phone (stemcells/tasks/phone-push.md). The rest of the page comes with
// stemcells/tasks/prompting.md's slice 6.

const TAKES: ReadonlyArray<{ readonly id: string; readonly kind: Kind; readonly what: string }> = [
  {
    id: "aski-takes-retry",
    kind: "retry",
    what: "When a Cell's run fails on a lost connection or its provider's error, Aski sends “Try that again.”",
  },
  {
    id: "aski-takes-go-ahead",
    kind: "goAhead",
    what: "When a Cell stops short of done and says what it does next, Aski sends “Go ahead.”",
  },
  {
    id: "aski-takes-implement",
    kind: "implement",
    what: "When a Cell's plan is ready, Aski takes it out of plan mode and sends it the plan to build.",
  },
];

const TAKES_HOW =
  " With it, Aski also tells the Cell to stop and ask you before anything final: a deploy, a merge, a release, deleting something, or spending or sending anything. After you take one the same way five times in a row, Aski offers this in the room. On, the card shows for 30 seconds with Undo first. A card that asks for something final, or a Cell you're writing to, stays yours.";

export function AskiSettingsPanel() {
  const askiTab = useAskiTabOn();
  const plans = useAskiPlans();
  const always = useCheckAlways();
  const cap = usePlanCap();
  const autonomy = useAutonomy();
  return (
    <SettingsPageContainer>
      <SettingsSection id="aski-tab" title="Aski">
        <SettingsRow
          id="aski-tab-on"
          title="Aski's tab"
          description="Aski's chat, first in the tab strip, with what needs you beside it. Off, there is no Aski tab and no Aski chat is started; a Cell that asks still glows in Awake and asks in its chat."
          control={
            <Switch
              checked={askiTab}
              aria-label="Aski's tab"
              onCheckedChange={(checked) => setAskiTabOn(checked)}
            />
          }
        />
      </SettingsSection>
      <SettingsSection id="aski-several-cells" title="Starting several Cells">
        <SettingsRow
          id="aski-plans"
          title={ASKI_SWITCHES["aski-plans"].title}
          description="One short call reads which Cells a message asks for, to Aski or in a new chat, and code checks it before any starts. Off, Aski only answers, and a new chat waits for your words."
          control={
            <Switch
              checked={plans}
              aria-label={ASKI_SWITCHES["aski-plans"].title}
              onCheckedChange={(checked) => setAskiPlans(checked)}
            />
          }
        />
        <SettingsRow
          id="aski-plan-check"
          title="Check every plan"
          description="Off, a Cell starts at once when you named its project and its words ask nothing final. On, every Cell waits for your tap. A deletion always waits for your held press."
          control={
            <Switch
              checked={always}
              aria-label="Check every plan"
              onCheckedChange={(checked) => setCheckAlways(checked)}
            />
          }
        />
        <SettingsRow
          id="aski-plan-cap"
          title="Most Cells one message starts"
          description="A message that asks for more waits for your tap before any of them starts."
          control={
            <select
              aria-label="Most Cells one message starts"
              className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              value={cap}
              onChange={(event) => setPlanCap(Number(event.target.value))}
            >
              {Array.from({ length: CEILING }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          }
        />
        <LearnedRow />
      </SettingsSection>
      <SettingsSection id="aski-takes" title="Aski takes for you">
        {TAKES.map(({ id, kind, what }) => (
          <SettingsRow
            key={id}
            id={id}
            title={KINDS[kind].title}
            description={what + TAKES_HOW}
            control={
              <Switch
                checked={autonomy?.granted.includes(kind) ?? false}
                disabled={autonomy === null}
                aria-label={KINDS[kind].title}
                onCheckedChange={(checked) => void setTaking(kind, checked)}
              />
            }
          />
        ))}
      </SettingsSection>
      <AsksMeasure />
      <PhoneSettings />
    </SettingsPageContainer>
  );
}

/** The names Aski learned from the person's own yes to a word it heard near, and forgetting them. */
function LearnedRow() {
  const [learned, setLearned] = useState<LearnedNames | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the learned names from this Mac's server when the page opens.
  useEffect(() => {
    let stopped = false;
    void readLearned().then((names) => {
      if (!stopped) setLearned(names);
    });
    return () => {
      stopped = true;
    };
  }, []);
  const names = learned === null ? [] : [...learned.places, ...learned.models];
  return (
    <SettingsRow
      id="aski-plan-learned"
      title="Names Aski learned"
      description={
        names.length === 0
          ? "When you say yes to a project or a model Aski heard under another word, Aski knows that word from then on. None yet."
          : `Words you confirmed: ${names.map((one) => `“${one.heard}” is ${one.name}`).join(", ")}.`
      }
      control={
        <Button
          size="compact"
          variant="outline"
          disabled={names.length === 0}
          onClick={() =>
            void forgetLearned().then((ok) => {
              if (ok) setLearned({ places: [], models: [] });
            })
          }
        >
          Forget
        </Button>
      }
    />
  );
}
