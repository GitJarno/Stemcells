import { createFileRoute } from "@tanstack/react-router";
import { AskiSettingsPanel } from "../stemcells/aski/AskiSettings";

export const Route = createFileRoute("/_chat/settings/aski")({ component: AskiSettingsPanel });
