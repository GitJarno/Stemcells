import { SettingsPageContainer, SettingsRow, SettingsSection, Switch } from "../upstream/settings";
import { setSuggestionsOn, useSuggestionsOn } from "../suggestions/switch";
import { setAskiPlans, useAskiPlans } from "./planning";

// Settings › Aski, first cut: whether Aski divides the work, and whether a
// finished Cell suggests what to say next. The rest of the page (what Aski
// thinks with, checking a plan, the most Cells, the plan history) comes with
// stemcells/tasks/prompting.md's slice 6.

export function AskiSettingsPanel() {
  const plans = useAskiPlans();
  const suggestions = useSuggestionsOn();
  return (
    <SettingsPageContainer>
      <SettingsSection id="aski-several-cells" title="Starting several Cells">
        <SettingsRow
          id="aski-plans"
          title="Aski divides the work"
          description="When a message starts several Cells and doesn't say what each does, Aski reads it in one short call on its model and gives each Cell its part. Off, the message waits until your words say what each Cell does."
          control={
            <Switch
              checked={plans}
              aria-label="Aski divides the work"
              onCheckedChange={(checked) => setAskiPlans(checked)}
            />
          }
        />
      </SettingsSection>
      <SettingsSection id="aski-next-prompt" title="Writing to a Cell">
        <SettingsRow
          id="aski-suggestions"
          title="Suggest what to say next"
          description="When a Cell finishes, its empty composer shows what you'd likely say next. Tab, → or a tap on its key fills it in; Esc hides it. Claude Cells predict their own after each turn, as Claude Code does, at almost no cost. For the others it's one short call on the text generation model, only for a chat you open within an hour of its reply. Off, this device asks for none, and no short call is made for it."
          control={
            <Switch
              checked={suggestions}
              aria-label="Suggest what to say next"
              onCheckedChange={(checked) => setSuggestionsOn(checked)}
            />
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
