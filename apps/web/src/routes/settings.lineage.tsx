import { createFileRoute } from "@tanstack/react-router";
import { LineageSettingsPanel } from "../stemcells/lineage/LineageSettings";

export const Route = createFileRoute("/settings/lineage")({ component: LineageSettingsPanel });
