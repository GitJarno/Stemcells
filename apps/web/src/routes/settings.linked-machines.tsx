import { createFileRoute } from "@tanstack/react-router";
import { LinkedMachinesPanel } from "../stemcells/peers/LinkedMachines";

export const Route = createFileRoute("/settings/linked-machines")({
  component: LinkedMachinesPanel,
});
