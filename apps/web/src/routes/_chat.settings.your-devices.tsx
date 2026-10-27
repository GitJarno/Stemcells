import { createFileRoute } from "@tanstack/react-router";
import { DevicesPanel } from "../stemcells/devices/DevicesPage";

export const Route = createFileRoute("/_chat/settings/your-devices")({
  component: DevicesPanel,
});
