import { KINDS, setTaking, useAutonomy, type Kind } from "../autonomy/autonomy";
import { PhoneSettings } from "../push/PhoneSettings";
import { SettingsPageContainer, SettingsRow, SettingsSection, Switch } from "../upstream/settings";
import { setSuggestionsOn, useSuggestionsOn } from "../suggestions/switch";
import { setAskiPlans, useAskiPlans } from "./planning";
import { ASKI_SWITCHES } from "./settingLinks";

// Settings › Aski: whether Aski divides the work, whether a finished Cell suggests what to say
// next, what Aski takes for the person (stemcells/tasks/aski-autonomy.md), and pushes to their
// phone (stemcells/tasks/phone-push.md). The rest of the page comes with
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
  const plans = useAskiPlans();
  const suggestions = useSuggestionsOn();
  const autonomy = useAutonomy();
  return (
    <SettingsPageContainer>
      <SettingsSection id="aski-several-cells" title="Starting several Cells">
        <SettingsRow
          id="aski-plans"
          title={ASKI_SWITCHES["aski-plans"].title}
          description="When a message starts several Cells and doesn't say what each does, Aski reads it in one short call on its model and gives each Cell its part. Off, the message waits until your words say what each Cell does."
          control={
            <Switch
              checked={plans}
              aria-label={ASKI_SWITCHES["aski-plans"].title}
              onCheckedChange={(checked) => setAskiPlans(checked)}
            />
          }
        />
      </SettingsSection>
      <SettingsSection id="aski-next-prompt" title="Writing to a Cell">
        <SettingsRow
          id="aski-suggestions"
          title={ASKI_SWITCHES.suggestions.title}
          description="When a Cell finishes, its empty composer shows what you'd likely say next. Tab, → or a tap on its key fills it in; Esc hides it. Claude Cells predict their own after each turn, as Claude Code does, at almost no cost. For the others it's one short call on the text generation model, only for a chat you open within an hour of its reply. Off, this device asks for none, and no short call is made for it."
          control={
            <Switch
              checked={suggestions}
              aria-label={ASKI_SWITCHES.suggestions.title}
              onCheckedChange={(checked) => setSuggestionsOn(checked)}
            />
          }
        />
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
      <PhoneSettings />
    </SettingsPageContainer>
  );
}
