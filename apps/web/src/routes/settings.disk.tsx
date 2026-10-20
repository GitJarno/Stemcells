import { createFileRoute } from "@tanstack/react-router";
import { DiskSettingsPanel } from "../stemcells/disk/DiskSettings";

export const Route = createFileRoute("/settings/disk")({ component: DiskSettingsPanel });
