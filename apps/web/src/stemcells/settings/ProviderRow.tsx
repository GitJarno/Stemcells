// A provider a reply's setting card names (stemcells/tasks/settings-in-chat.md): where it stands
// on the chat's machine in Settings' own words, the models it offers, and, while it isn't signed
// in, Settings' own sign-in, so the person signs in from the chat.
import { modelsLine, offersSignIn } from "../../../../../stemcells/settings/providers.ts";
import { placeKey, type SettingsPlace } from "../../../../../stemcells/settings/places.ts";
import { ProviderLogo } from "../upstream/providers";
import {
  getProviderStatusKey,
  getProviderSummary,
  PROVIDER_STATUS_STYLES,
  ProviderAuthenticationSection,
  SettingsRow,
  useMachineProvider,
} from "../upstream/settings";
import { PlaceLink } from "./PlaceLink";

export function ProviderRow(props: {
  readonly place: Extract<SettingsPlace, { kind: "provider" }>;
  readonly title: string;
  readonly environmentId: string;
}) {
  const machine = useMachineProvider(props.environmentId, props.place.driver);
  const { provider } = machine;
  const summary = getProviderSummary(provider ?? undefined);
  const dot = PROVIDER_STATUS_STYLES[getProviderStatusKey(provider ?? undefined)].dot;
  const models = provider === null ? null : modelsLine(provider);
  const signsIn = provider !== null && offersSignIn(provider);
  return (
    <div data-setting-card-provider="">
      <SettingsRow
        title={
          <span data-setting-card-provider-title="">
            <ProviderLogo driver={props.place.driver} />
            {props.title}
          </span>
        }
        description={
          <span data-setting-card-status="">
            <span data-setting-card-dot="" className={dot} aria-hidden="true" />
            {summary.headline}
          </span>
        }
        control={
          <PlaceLink
            placeKey={placeKey(props.place)}
            label={props.title}
            environmentId={props.environmentId}
          >
            Open in Settings
          </PlaceLink>
        }
      />
      {models === null ? null : <p data-setting-card-models="">{models}</p>}
      {signsIn ? (
        <ProviderAuthenticationSection
          environmentId={machine.environmentId}
          environmentLabel={machine.environmentLabel}
          instanceId={machine.instanceId}
          provider={provider}
          readOnly={machine.readOnly}
        />
      ) : null}
    </div>
  );
}
