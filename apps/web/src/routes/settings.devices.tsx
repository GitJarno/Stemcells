import { createFileRoute } from "@tanstack/react-router";
import { DevicesPanel } from "../stemcells/devices/DevicesPage";

export const Route = createFileRoute("/settings/devices")({
  component: DevicesPanel,
});
