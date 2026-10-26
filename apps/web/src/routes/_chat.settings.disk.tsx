import { createFileRoute } from "@tanstack/react-router";
import { DiskSettingsPanel } from "../stemcells/disk/DiskSettings";

export const Route = createFileRoute("/_chat/settings/disk")({ component: DiskSettingsPanel });
