import { SettingsPageContainer, SettingsRow, SettingsSection, Switch } from "../upstream/settings";
import { setAskiPlans, useAskiPlans } from "./planning";

// Settings › Aski, first cut: whether Aski divides the work. The rest of the
// page (what Aski thinks with, checking a plan, the most Cells, the plan
// history) comes with stemcells/tasks/prompting.md's slice 6.

export function AskiSettingsPanel() {
  const plans = useAskiPlans();
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
    </SettingsPageContainer>
  );
}
