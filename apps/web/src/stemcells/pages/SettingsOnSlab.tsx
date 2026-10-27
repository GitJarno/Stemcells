import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SETTINGS_SECTIONS, SettingsSidebarNav } from "../upstream/settings";
import {
  Button,
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../upstream/ui";
import "./settings.css";

/**
 * Settings on the slate: upstream's section list at its left edge, the panel beside it. On a
 * narrow slate the list folds into a menu row at the top. `actions` (General's restore button)
 * stand at the right of that row, which shows for them alone when the list has room.
 */
export function SettingsOnSlab(props: {
  pathname: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-stemcells-settings="">
      <aside data-stemcells-settings-list="" aria-label="Settings sections">
        <SettingsSidebarNav pathname={props.pathname} />
      </aside>
      <div data-stemcells-settings-panel="">
        <div data-stemcells-settings-row="" data-actions={props.actions ? "" : undefined}>
          <SectionMenu pathname={props.pathname} />
          {props.actions ? <div data-stemcells-settings-actions="">{props.actions}</div> : null}
        </div>
        {props.children}
      </div>
    </div>
  );
}

const DETAIL_PAGE_PARENTS: Readonly<Record<string, string>> = {
  "/settings/diagnostics": "/settings/maintenance",
  "/settings/open-source-licenses": "/settings/about",
};

/** The list, folded: the section you are in, and the others to go to. */
function SectionMenu(props: { pathname: string }) {
  const navigate = useNavigate();
  // A detail page lights the page that links to it, as upstream's list does.
  const pathname = DETAIL_PAGE_PARENTS[props.pathname] ?? props.pathname;
  const current = SETTINGS_SECTIONS.find(
    (section) => pathname === section.to || pathname.startsWith(`${section.to}/`),
  );
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="sm" data-stemcells-settings-menu="" />}>
        {current?.label ?? "Settings"}
        <ChevronDownIcon aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuRadioGroup
          value={current?.to ?? null}
          onValueChange={(to: (typeof SETTINGS_SECTIONS)[number]["to"]) =>
            void navigate({ to, hash: "", replace: true, hashScrollIntoView: false })
          }
        >
          {SETTINGS_SECTIONS.map((section) => (
            <MenuRadioItem key={section.to} value={section.to}>
              {section.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
