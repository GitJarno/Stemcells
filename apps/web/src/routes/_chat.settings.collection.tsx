import { createFileRoute } from "@tanstack/react-router";
import { CollectionSettingsPanel } from "../stemcells/collection/CollectionSettings";

export const Route = createFileRoute("/_chat/settings/collection")({
  component: CollectionSettingsPanel,
});
